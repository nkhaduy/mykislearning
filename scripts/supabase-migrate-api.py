#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://api.supabase.com/v1"
MIGRATION_RE = re.compile(r"^([0-9]{3,14})_([A-Za-z0-9_]+)\.sql$")


def fail(message, code=1):
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(code)


def require_env(name):
    value = os.environ.get(name, "")
    if not value:
        fail(f"Missing required environment variable: {name}")
    return value


def request(method, path, token, body=None, idempotency_key=None):
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "MyKIS-Deploy/1.0",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            if not raw:
                return resp.status, None
            return resp.status, json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        message = raw[:300] if raw else exc.reason
        return exc.code, {"error": message}


def read_local_migrations(root):
    migrations_dir = root / "supabase" / "migrations"
    if not migrations_dir.is_dir():
        fail("Missing supabase/migrations directory")
    seen = set()
    rows = []
    for path in sorted(migrations_dir.glob("*.sql")):
        match = MIGRATION_RE.match(path.name)
        if not match:
            fail(f"Invalid migration filename: {path.name}")
        version, name = match.groups()
        if version in seen:
            fail(f"Duplicate migration version: {version}")
        seen.add(version)
        sql = path.read_text(encoding="utf-8")
        sha = hashlib.sha256(sql.encode("utf-8")).hexdigest()
        rows.append({"version": version, "name": name, "filename": path.name, "path": path, "sql": sql, "sha": sha})
    return rows


def list_remote(token, project_ref):
    status, body = request("GET", f"/projects/{project_ref}/database/migrations", token)
    if status != 200:
        fail(f"Management Migration API list failed with HTTP {status}")
    if not isinstance(body, list):
        fail("Unexpected migration history response")
    return [{"version": str(item.get("version", "")), "name": str(item.get("name", ""))} for item in body]


def validate_history(local, remote):
    local_by_version = {m["version"]: m for m in local}
    local_by_stem = {f"{m['version']}_{m['name']}": m for m in local}
    remote_by_version = {}
    applied_local_versions = {}
    for item in remote:
        version = item["version"]
        name = item.get("name", "")
        if not version:
            fail("Remote migration history contains empty version")
        if version in remote_by_version:
            fail(f"Remote migration history contains duplicate version: {version}")
        remote_by_version[version] = item
        if version in local_by_version:
            applied_local_versions[version] = item
        elif name in local_by_stem:
            # The Management API currently generates the remote version and stores
            # the supplied local stem in name. Treat this as the local migration
            # being applied without rewriting migration history by hand.
            applied_local_versions[local_by_stem[name]["version"]] = item
        else:
            fail(f"Remote migration {version} does not exist locally; history mismatch")

    if applied_local_versions:
        max_remote = max(applied_local_versions)
        for m in local:
            if m["version"] < max_remote and m["version"] not in applied_local_versions:
                fail(f"Local migration {m['version']} is older than remote head but missing remotely; history mismatch")

    # Current API list response contains version/name only, so checksum comparison is not available.
    return applied_local_versions


def print_plan(local, remote_by_version):
    for m in local:
        if m["version"] in remote_by_version:
            remote_version = remote_by_version[m["version"]].get("version", m["version"])
            print(f"{m['version']} {m['name']} sha256={m['sha']} applied remote_version={remote_version}")
        else:
            print(f"{m['version']} {m['name']} sha256={m['sha']} pending")


def apply_pending(local, remote_by_version, token, project_ref):
    pending = [m for m in local if m["version"] not in remote_by_version]
    for m in pending:
        print(f"Applying migration {m['version']} {m['name']} sha256={m['sha']}")
        body = {
            "query": m["sql"],
            "name": f"{m['version']}_{m['name']}",
        }
        status, response_body = request(
            "POST",
            f"/projects/{project_ref}/database/migrations",
            token,
            body=body,
            idempotency_key=f"mykis-migration-{m['version']}-{m['sha']}",
        )
        if status != 200:
            detail = ""
            if isinstance(response_body, dict) and response_body.get("error"):
                detail = f": {response_body['error']}"
            fail(f"Apply failed for {m['version']} with HTTP {status}{detail}")

        status_after, body_after = request("GET", f"/projects/{project_ref}/database/migrations", token)
        if status_after != 200 or not isinstance(body_after, list):
            fail(f"Unable to verify migration history after applying {m['version']}")
        stem = f"{m['version']}_{m['name']}"
        matched = [
            item for item in body_after
            if str(item.get("version", "")) == m["version"] or str(item.get("name", "")) == stem
        ]
        if not matched:
            fail(f"Migration {m['version']} applied but remote history did not report the same local version")
        print(f"Verified migration {m['version']} in remote history as remote_version={matched[-1].get('version', '')}")


def main():
    parser = argparse.ArgumentParser(description="Apply Supabase migrations via Management API without direct Postgres access.")
    parser.add_argument("mode", choices=["dry-run", "apply"])
    args = parser.parse_args()

    token = require_env("SUPABASE_ACCESS_TOKEN")
    project_ref = require_env("SUPABASE_PROJECT_ID")
    root = Path.cwd()
    local = read_local_migrations(root)
    remote = list_remote(token, project_ref)
    remote_by_version = validate_history(local, remote)
    print_plan(local, remote_by_version)
    pending = [m for m in local if m["version"] not in remote_by_version]
    print(f"Pending migrations: {len(pending)}")
    if args.mode == "apply":
        apply_pending(local, remote_by_version, token, project_ref)


if __name__ == "__main__":
    main()
