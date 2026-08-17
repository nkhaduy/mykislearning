from collections.abc import Mapping, Sequence

from .models import Chapter, Course, Lesson, MigrationBundle, Unmapped, User


class MigrationError(ValueError):
    pass


def _roles(role: str) -> tuple[str, ...]:
    if role.lower() in {"hr", "admin"}:
        return ("LMS Student", "Course Creator", "Moderator", "System Manager")
    return ("LMS Student",)


def normalize_legacy(source: Mapping[str, Sequence[Mapping]]) -> MigrationBundle:
    users: list[User] = []
    seen_emails: set[str] = set()
    for row in source.get("profiles", ()):
        email = str(row.get("email") or "").strip().lower()
        if not email:
            raise MigrationError(f"profile {row.get('id')} has no email")
        if email in seen_emails:
            raise MigrationError(f"duplicate email: {email}")
        seen_emails.add(email)
        users.append(
            User(
                legacy_id=str(row["id"]),
                email=email,
                full_name=str(row.get("full_name") or email),
                employee_code=row.get("employee_code"),
                roles=_roles(str(row.get("role") or "employee")),
                enabled=str(row.get("account_status") or "active") == "active",
            )
        )

    courses = tuple(
        Course(
            legacy_id=str(row["id"]),
            title=str(row.get("title") or "Untitled Course"),
            description=str(row.get("description") or ""),
            published=str(row.get("status") or "draft") == "published",
        )
        for row in source.get("courses", ())
    )
    course_ids = {course.legacy_id for course in courses}
    chapters_by_course: dict[str, Chapter] = {}
    lessons: list[Lesson] = []
    unmapped: list[Unmapped] = []

    for row in source.get("course_content", source.get("course_contents", ())):
        legacy_id = str(row["id"])
        course_id = str(row.get("course_id") or "")
        if course_id not in course_ids:
            unmapped.append(Unmapped("course_content", legacy_id, f"missing course: {course_id}"))
            continue
        lesson_type = str(row.get("type") or "text")
        if lesson_type not in {"text", "slide", "video", "quiz"}:
            unmapped.append(Unmapped("course_content", legacy_id, f"unsupported lesson type: {lesson_type}"))
            continue
        chapter = chapters_by_course.setdefault(
            course_id,
            Chapter(legacy_id=f"{course_id}:default", course_legacy_id=course_id, title="Course Content"),
        )
        source_url = str(row.get("source_url") or "").strip() or None
        lessons.append(
            Lesson(
                legacy_id=legacy_id,
                course_legacy_id=course_id,
                chapter_legacy_id=chapter.legacy_id,
                title=str(row.get("title") or "Untitled Lesson"),
                body=str(row.get("transcript") or row.get("content") or ""),
                youtube=source_url if lesson_type == "video" else None,
            )
        )

    return MigrationBundle(
        users=tuple(users),
        courses=courses,
        chapters=tuple(chapters_by_course.values()),
        lessons=tuple(lessons),
        unmapped=tuple(unmapped),
    )
