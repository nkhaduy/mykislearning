import unittest

from migration.kis_frappe_migration.importer import UpsertResult, import_bundle
from migration.kis_frappe_migration.normalize import normalize_legacy


class MemoryFrappeClient:
    def __init__(self):
        self.documents = {}

    def upsert(self, doctype, legacy_id, payload):
        key = (doctype, legacy_id)
        action = "updated" if key in self.documents else "created"
        self.documents[key] = dict(payload)
        return UpsertResult(action=action, name=f"{doctype}:{legacy_id}")


class ImportBundleTest(unittest.TestCase):
    def setUp(self):
        self.bundle = normalize_legacy(
            {
                "profiles": [{"id": "u1", "email": "learner@kis.vn", "full_name": "Learner", "role": "employee"}],
                "courses": [{"id": "c1", "title": "Security", "status": "published"}],
                "course_content": [{"id": "l1", "course_id": "c1", "title": "Intro", "type": "text", "content": "Welcome"}],
            }
        )

    def test_imports_in_dependency_order_and_is_idempotent(self):
        client = MemoryFrappeClient()
        first = import_bundle(self.bundle, client)
        second = import_bundle(self.bundle, client)

        self.assertEqual(first.counts, {"User": 1, "LMS Course": 1, "Course Chapter": 1, "Course Lesson": 1})
        self.assertEqual(first.created, 4)
        self.assertEqual(second.created, 0)
        self.assertEqual(second.updated, 4)
        self.assertEqual(len(client.documents), 4)
        self.assertEqual(client.documents[("Course Chapter", "c1:default")]["course"], "LMS Course:c1")
        self.assertEqual(client.documents[("Course Lesson", "l1")]["course"], "LMS Course:c1")
        self.assertEqual(client.documents[("Course Lesson", "l1")]["chapter"], "Course Chapter:c1:default")

    def test_dry_run_does_not_write(self):
        client = MemoryFrappeClient()
        report = import_bundle(self.bundle, client, dry_run=True)
        self.assertEqual(client.documents, {})
        self.assertEqual(report.planned, 4)


if __name__ == "__main__":
    unittest.main()
