import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / "frappe" / "compose.yaml"


class DeploymentConfigTest(unittest.TestCase):
    def test_bootstrap_creates_idempotent_legacy_fields(self):
        script = (ROOT / "frappe" / "scripts" / "bootstrap-site.sh").read_text()
        self.assertIn('frappe.db.exists("Custom Field", name)', script)
        self.assertIn('"custom_kis_legacy_id"', script)
        self.assertIn('"custom_kis_employee_code"', script)

    def test_compose_is_pinned_persistent_and_has_health_checks(self):
        compose = shutil.which("docker-compose") or "/opt/homebrew/lib/docker/cli-plugins/docker-compose"
        env = os.environ.copy()
        env["FRAPPE_PLATFORM"] = "linux/arm64"
        result = subprocess.run(
            [compose, "-f", str(COMPOSE), "config", "--format", "json"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
            env=env,
        )
        config = json.loads(result.stdout)
        services = config["services"]

        expected_image = "mykis/frappe-lms:v2.61.0-d3bfe97d"
        for name in ("backend", "frontend", "websocket", "queue-short", "queue-long", "scheduler"):
            self.assertEqual(services[name]["image"], expected_image)

        build = services["backend"]["build"]
        self.assertEqual(services["backend"]["platform"], "linux/arm64")
        self.assertEqual(build["dockerfile"], "images/layered/Containerfile")
        self.assertEqual(build["args"]["FRAPPE_BRANCH"], "version-16")
        self.assertEqual(build["secrets"][0]["source"], "apps_json")
        self.assertEqual(services["websocket"]["ports"][0]["published"], "9000")
        apps = json.loads((ROOT / "frappe" / "apps.json").read_text())
        self.assertEqual(apps[1]["branch"], "v2.61.0")

        self.assertIn("healthcheck", services["mariadb"])
        self.assertIn("healthcheck", services["redis-cache"])
        self.assertIn("healthcheck", services["redis-queue"])
        self.assertIn("sites", config["volumes"])
        self.assertIn("db-data", config["volumes"])

        self.assertEqual(
            services["mariadb"]["environment"]["MARIADB_ROOT_PASSWORD_FILE"],
            "/run/secrets/db_root",
        )
        self.assertEqual(
            {secret["source"] for secret in services["create-site"]["secrets"]},
            {"db_root", "site_admin"},
        )


if __name__ == "__main__":
    unittest.main()
