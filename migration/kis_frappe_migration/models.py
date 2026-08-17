from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    legacy_id: str
    email: str
    full_name: str
    employee_code: str | None
    roles: tuple[str, ...]
    enabled: bool


@dataclass(frozen=True)
class Course:
    legacy_id: str
    title: str
    description: str
    published: bool


@dataclass(frozen=True)
class Chapter:
    legacy_id: str
    course_legacy_id: str
    title: str


@dataclass(frozen=True)
class Lesson:
    legacy_id: str
    course_legacy_id: str
    chapter_legacy_id: str
    title: str
    body: str
    youtube: str | None


@dataclass(frozen=True)
class Unmapped:
    source_table: str
    legacy_id: str
    reason: str


@dataclass(frozen=True)
class MigrationBundle:
    users: tuple[User, ...] = ()
    courses: tuple[Course, ...] = ()
    chapters: tuple[Chapter, ...] = ()
    lessons: tuple[Lesson, ...] = ()
    unmapped: tuple[Unmapped, ...] = ()
