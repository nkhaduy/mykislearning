#!/usr/bin/env bash
set -euo pipefail

site_name="${SITE_NAME:-lms.localhost}"
site_path="/home/frappe/frappe-bench/sites/${site_name}"

ensure_migration_fields() {
  bench --site "$site_name" console <<'PY'
import frappe

fields = {
    "User": [
        {"fieldname": "custom_kis_legacy_id", "label": "KIS Legacy ID", "fieldtype": "Data", "unique": 1},
        {"fieldname": "custom_kis_employee_code", "label": "KIS Employee Code", "fieldtype": "Data"},
    ],
    "LMS Course": [
        {"fieldname": "custom_kis_legacy_id", "label": "KIS Legacy ID", "fieldtype": "Data", "unique": 1},
    ],
    "Course Chapter": [
        {"fieldname": "custom_kis_legacy_id", "label": "KIS Legacy ID", "fieldtype": "Data", "unique": 1},
    ],
    "Course Lesson": [
        {"fieldname": "custom_kis_legacy_id", "label": "KIS Legacy ID", "fieldtype": "Data", "unique": 1},
    ],
}

for doctype, definitions in fields.items():
    for definition in definitions:
        name = f"{doctype}-{definition['fieldname']}"
        if not frappe.db.exists("Custom Field", name):
            frappe.get_doc({"doctype": "Custom Field", "dt": doctype, **definition}).insert()
frappe.db.commit()
PY
}

if [[ -f "${site_path}/site_config.json" ]]; then
  bench --site "$site_name" migrate
  ensure_migration_fields
  exit 0
fi

db_root="$(< /run/secrets/db_root)"
site_admin="$(< /run/secrets/site_admin)"
bench new-site "$site_name" --mariadb-root-password "$db_root" --admin-password "$site_admin" --no-mariadb-socket
bench --site "$site_name" install-app payments
bench --site "$site_name" install-app lms
ensure_migration_fields
bench --site "$site_name" set-config host_name "https://${site_name}"
bench --site "$site_name" clear-cache
