from dataclasses import dataclass
from typing import Protocol

from .models import MigrationBundle


class FrappeClient(Protocol):
    def upsert(self, doctype: str, legacy_id: str, payload: dict) -> "UpsertResult": ...


@dataclass(frozen=True)
class UpsertResult:
    action: str
    name: str


@dataclass(frozen=True)
class ImportReport:
    counts: dict[str, int]
    created: int = 0
    updated: int = 0
    planned: int = 0
    unmapped: int = 0


def import_bundle(bundle: MigrationBundle, client: FrappeClient, dry_run: bool = False) -> ImportReport:
    documents: list[tuple[str, str, dict]] = []
    for user in bundle.users:
        documents.append(
            (
                "User",
                user.legacy_id,
                {
                    "email": user.email,
                    "first_name": user.full_name,
                    "enabled": int(user.enabled),
                    "send_welcome_email": 0,
                    "roles": [{"role": role} for role in user.roles],
                    "custom_kis_employee_code": user.employee_code,
                },
            )
        )
    for course in bundle.courses:
        documents.append(
            (
                "LMS Course",
                course.legacy_id,
                {
                    "title": course.title,
                    "description": course.description or course.title,
                    "short_introduction": course.description or course.title,
                    "published": int(course.published),
                },
            )
        )
    counts = {
        "User": len(bundle.users),
        "LMS Course": len(bundle.courses),
        "Course Chapter": len(bundle.chapters),
        "Course Lesson": len(bundle.lessons),
    }
    if dry_run:
        return ImportReport(counts=counts, planned=sum(counts.values()), unmapped=len(bundle.unmapped))

    created = updated = 0
    names: dict[tuple[str, str], str] = {}
    for doctype, legacy_id, payload in documents:
        result = client.upsert(doctype, legacy_id, payload)
        names[(doctype, legacy_id)] = result.name
        if result.action == "created":
            created += 1
        elif result.action == "updated":
            updated += 1
        else:
            raise ValueError(f"unexpected upsert action: {result.action}")

    for chapter in bundle.chapters:
        result = client.upsert(
            "Course Chapter",
            chapter.legacy_id,
            {"title": chapter.title, "course": names[("LMS Course", chapter.course_legacy_id)]},
        )
        names[("Course Chapter", chapter.legacy_id)] = result.name
        created += result.action == "created"
        updated += result.action == "updated"

    for lesson in bundle.lessons:
        result = client.upsert(
            "Course Lesson",
            lesson.legacy_id,
            {
                "title": lesson.title,
                "body": lesson.body,
                "youtube": lesson.youtube,
                "course": names[("LMS Course", lesson.course_legacy_id)],
                "chapter": names[("Course Chapter", lesson.chapter_legacy_id)],
            },
        )
        created += result.action == "created"
        updated += result.action == "updated"
    return ImportReport(counts=counts, created=created, updated=updated, unmapped=len(bundle.unmapped))
