#!/usr/bin/env python3
import argparse
import json
import os
from dataclasses import asdict
from pathlib import Path

from kis_frappe_migration.frappe_client import RestFrappeClient
from kis_frappe_migration.importer import import_bundle
from kis_frappe_migration.normalize import normalize_legacy


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a versioned KIS JSON export into Frappe Learning")
    parser.add_argument("source", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report", type=Path, default=Path("frappe-migration-report.json"))
    args = parser.parse_args()

    source = json.loads(args.source.read_text())
    bundle = normalize_legacy(source)
    if args.dry_run:
        class NoWriteClient:
            def upsert(self, *_):
                raise AssertionError("dry-run attempted a write")
        client = NoWriteClient()
    else:
        required = ("FRAPPE_URL", "FRAPPE_API_KEY", "FRAPPE_API_SECRET")
        missing = [name for name in required if not os.environ.get(name)]
        if missing:
            parser.error("missing environment variables: " + ", ".join(missing))
        client = RestFrappeClient(os.environ["FRAPPE_URL"], os.environ["FRAPPE_API_KEY"], os.environ["FRAPPE_API_SECRET"])

    report = import_bundle(bundle, client, dry_run=args.dry_run)
    output = {**asdict(report), "unmapped_records": [asdict(item) for item in bundle.unmapped]}
    args.report.write_text(json.dumps(output, indent=2, ensure_ascii=True) + "\n")
    return 0 if not bundle.unmapped else 2


if __name__ == "__main__":
    raise SystemExit(main())
