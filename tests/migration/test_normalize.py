import unittest

from migration.kis_frappe_migration.normalize import MigrationError, normalize_legacy


class NormalizeLegacyTest(unittest.TestCase):
    def test_maps_employee_and_hr_roles(self):
        bundle = normalize_legacy(
            {
                "profiles": [
                    {"id": "u1", "email": "employee@kis.vn", "full_name": "Employee One", "role": "employee"},
                    {"id": "u2", "email": "hr@kis.vn", "full_name": "HR One", "role": "hr"},
                ]
            }
        )
        self.assertEqual(bundle.users[0].roles, ("LMS Student",))
        self.assertEqual(
            bundle.users[1].roles,
            ("LMS Student", "Course Creator", "Moderator", "System Manager"),
        )

    def test_generates_one_chapter_for_flat_course_content(self):
        bundle = normalize_legacy(
            {
                "courses": [{"id": "c1", "title": "Security", "status": "published"}],
                "course_content": [
                    {"id": "l1", "course_id": "c1", "title": "Intro", "type": "video", "source_url": "https://example.test/video"}
                ],
            }
        )
        self.assertEqual([(chapter.legacy_id, chapter.title) for chapter in bundle.chapters], [("c1:default", "Course Content")])
        self.assertEqual(bundle.lessons[0].chapter_legacy_id, "c1:default")

    def test_duplicate_email_fails_instead_of_overwriting_identity(self):
        with self.assertRaisesRegex(MigrationError, "duplicate email"):
            normalize_legacy(
                {
                    "profiles": [
                        {"id": "u1", "email": "same@kis.vn", "full_name": "One"},
                        {"id": "u2", "email": "SAME@kis.vn", "full_name": "Two"},
                    ]
                }
            )

    def test_unsupported_required_lesson_is_reported(self):
        bundle = normalize_legacy(
            {
                "courses": [{"id": "c1", "title": "Course"}],
                "course_content": [
                    {"id": "l1", "course_id": "c1", "title": "Package", "type": "binary-package", "is_required": True}
                ],
            }
        )
        self.assertEqual(bundle.lessons, ())
        self.assertEqual(bundle.unmapped[0].reason, "unsupported lesson type: binary-package")


if __name__ == "__main__":
    unittest.main()
