/**
 * Backfill seed data from mockDatabase.js constants into Supabase.
 * Uses the Worker API so no service-role key needed locally.
 * Safe to re-run: all POSTs are upserts by ID.
 *
 * Usage: node scripts/backfill-seed.mjs [--base https://mykis-learning.nkhaduy.workers.dev]
 */

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://mykis-learning.nkhaduy.workers.dev";

const HR_EMAIL = "hr.demo@kisvn.vn";
const HR_PASS  = "KIS@HR2026!";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login() {
  const res = await fetch(`${BASE}/api/auth?action=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: HR_EMAIL, password: HR_PASS }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${body.error || res.status}`);
  console.log(`✓ Logged in as ${body.profile.fullName} (${body.profile.role})`);
  return body.access_token;
}

async function post(token, path, data) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Account-Id": "acc-hr-demo",
      "X-Account-Role": "hr",
    },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} failed: ${body.error || res.status}`);
  return body;
}

async function batchPost(token, path, items, labelFn) {
  let inserted = 0, updated = 0, failed = 0;
  for (const item of items) {
    try {
      await post(token, path, item);
      inserted++;
      console.log(`  + ${labelFn(item)}`);
    } catch (err) {
      if (err.message.includes("duplicate") || err.message.includes("already")) {
        updated++;
        console.log(`  ~ ${labelFn(item)} (skipped, already exists)`);
      } else {
        failed++;
        console.error(`  ✗ ${labelFn(item)}: ${err.message}`);
      }
    }
  }
  return { inserted, updated, failed };
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const COURSES = [
  {
    id: "course-001",
    title: "Leadership Training Course",
    description: "Phát triển năng lực lãnh đạo",
    status: "published",
    deliveryMode: "offline",
    durationHours: 16,
    category: "Kỹ năng mềm",
    imageAlt: "Leadership Training Course",
    createdAt: "2026-01-01 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
  },
  {
    id: "course-002",
    title: "Communication Training Course",
    description: "Kỹ năng giao tiếp và trình bày",
    status: "published",
    deliveryMode: "offline",
    durationHours: 12,
    category: "Kỹ năng mềm",
    imageAlt: "Communication Training Course",
    createdAt: "2026-01-05 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
  },
  {
    id: "course-003",
    title: "Kiến thức chứng khoán cơ bản",
    description: "Củng cố kiến thức tài chính và chứng khoán",
    status: "published",
    deliveryMode: "online",
    durationHours: 8,
    category: "Chuyên môn",
    imageAlt: "Kiến thức chứng khoán cơ bản",
    createdAt: "2026-01-10 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
  },
  {
    id: "course-004",
    title: "Ôn tập Chứng chỉ hành nghề",
    description: "Lộ trình ôn tập CCHN môi giới chứng khoán",
    status: "published",
    deliveryMode: "hybrid",
    durationHours: 40,
    category: "Chứng chỉ hành nghề",
    imageAlt: "Ôn tập Chứng chỉ hành nghề",
    createdAt: "2026-01-15 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
  },
  {
    id: "course-005",
    title: "Kỹ năng báo cáo và trình bày",
    description: "Chuẩn hóa kỹ năng báo cáo",
    status: "draft",
    deliveryMode: "online",
    durationHours: 6,
    category: "Kỹ năng mềm",
    imageAlt: "Kỹ năng báo cáo và trình bày",
    createdAt: "2026-02-01 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
  },
];

const EMPLOYEES = [
  {
    id: "acc-001",
    employee_code: "KIS001",
    full_name: "Nguyễn Văn An",
    email: "an.nguyen@kisvn.vn",
    role: "employee",
    department: "Môi giới",
    position: "Môi giới chứng khoán",
    account_status: "active",
  },
  {
    id: "acc-002",
    employee_code: "KIS002",
    full_name: "Trần Minh Anh",
    email: "minh.anh@kisvn.vn",
    role: "employee",
    department: "Phân tích",
    position: "Chuyên viên phân tích",
    account_status: "active",
  },
  {
    id: "acc-003",
    employee_code: "KIS003",
    full_name: "Lê Hoàng Nam",
    email: "cuong.le@kisvn.vn",
    role: "employee",
    department: "Vận hành",
    position: "Chuyên viên vận hành",
    account_status: "inactive",
  },
  {
    id: "acc-004",
    employee_code: "KIS004",
    full_name: "Phạm Thu Hà",
    email: "thu.ha@kisvn.vn",
    role: "employee",
    department: "Nhân sự",
    position: "Chuyên viên L&D",
    account_status: "active",
  },
  {
    id: "acc-005",
    employee_code: "KIS005",
    full_name: "Hoàng Văn Em",
    email: "em.hoang@kisvn.vn",
    role: "employee",
    department: "Kinh doanh",
    position: "Kinh doanh senior",
    account_status: "active",
  },
  {
    id: "acc-hr-demo",
    employee_code: "KIS-HR-DEMO",
    full_name: "HR Demo",
    email: "hr.demo@kisvn.vn",
    role: "hr",
    department: "Nhân sự",
    position: "HR Demo",
    account_status: "active",
  },
  {
    id: "acc-hr-001",
    employee_code: "KIS-HR-001",
    full_name: "HR Manager",
    email: "hr@kisvn.vn",
    role: "hr",
    department: "Nhân sự",
    position: "HR Manager",
    account_status: "active",
  },
];

const ENROLLMENTS = [
  { id: "enr-001", courseId: "course-001", accountId: "acc-001", status: "completed",   assignedBy: "acc-hr-demo", deadline: "2026-03-31", progress: 100 },
  { id: "enr-002", courseId: "course-002", accountId: "acc-001", status: "inProgress",  assignedBy: "acc-hr-demo", deadline: "2026-04-30", progress: 45  },
  { id: "enr-003", courseId: "course-003", accountId: "acc-002", status: "inProgress",  assignedBy: "acc-hr-demo", deadline: "2026-04-15", progress: 60  },
  { id: "enr-004", courseId: "course-004", accountId: "acc-002", status: "notStarted",  assignedBy: "acc-hr-demo", deadline: "2026-05-31", progress: 0   },
  { id: "enr-005", courseId: "course-001", accountId: "acc-004", status: "inProgress",  assignedBy: "acc-hr-demo", deadline: "2026-03-31", progress: 30  },
  { id: "enr-006", courseId: "course-003", accountId: "acc-005", status: "notStarted",  assignedBy: "acc-hr-demo", deadline: "2026-04-30", progress: 0   },
  { id: "enr-007", courseId: "course-002", accountId: "acc-004", status: "overdue",     assignedBy: "acc-hr-demo", deadline: "2026-02-28", progress: 75  },
  { id: "enr-008", courseId: "course-004", accountId: "acc-001", status: "notStarted",  assignedBy: "acc-hr-demo", deadline: "2026-06-30", progress: 0   },
];

const NOTIFICATIONS = [
  {
    id: "notif-001",
    accountId: "acc-001",
    type: "course_assigned",
    title: "Khóa học mới được giao",
    body: "Bạn được giao khóa học: Leadership Training Course",
    link: "/dashboard/courses",
    isRead: false,
  },
  {
    id: "notif-002",
    accountId: "acc-004",
    type: "deadline_reminder",
    title: "Nhắc nhở hạn nộp",
    body: "Khóa học Communication Training Course sắp đến hạn",
    link: "/dashboard/courses",
    isRead: false,
  },
  {
    id: "notif-003",
    accountId: "acc-001",
    type: "course_completed",
    title: "Hoàn thành khóa học",
    body: "Bạn đã hoàn thành: Leadership Training Course. Xin chúc mừng!",
    link: "/dashboard/courses",
    isRead: true,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Backfill seed data → ${BASE}\n`);

  const token = await login();

  // ── Employees (PATCH to upsert profiles) ─────────────────────────────────
  console.log("\n📋 Employees:");
  let empStats = { inserted: 0, updated: 0, failed: 0 };
  for (const emp of EMPLOYEES) {
    try {
      const res = await fetch(`${BASE}/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Account-Id": "acc-hr-demo",
          "X-Account-Role": "hr",
        },
        body: JSON.stringify(emp),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.status);
      empStats.inserted++;
      console.log(`  + ${emp.full_name} (${emp.id})`);
    } catch (err) {
      empStats.failed++;
      console.error(`  ✗ ${emp.full_name}: ${err.message}`);
    }
  }
  console.log(`  → ${empStats.inserted} upserted, ${empStats.failed} failed`);

  // ── Courses ────────────────────────────────────────────────────────────────
  console.log("\n📚 Courses:");
  const courseStats = await batchPost(token, "/api/courses", COURSES, (c) => `${c.id}: ${c.title}`);
  console.log(`  → ${courseStats.inserted} inserted, ${courseStats.updated} skipped, ${courseStats.failed} failed`);

  // ── Enrollments ───────────────────────────────────────────────────────────
  console.log("\n📝 Enrollments:");
  const enrollPayload = ENROLLMENTS.map((e) => ({
    ...e,
    course_id: e.courseId,
    account_id: e.accountId,
    assigned_by: e.assignedBy,
    deadline: e.deadline,
    data: {
      id: e.id,
      courseId: e.courseId,
      accountId: e.accountId,
      assignedBy: e.assignedBy,
      deadline: e.deadline,
      status: e.status,
      progress: e.progress,
      enrolledAt: new Date().toISOString(),
    },
  }));
  const enrStats = await batchPost(
    token,
    "/api/enrollments",
    [{ enrollments: enrollPayload }],
    () => `${ENROLLMENTS.length} enrollments`,
  );
  console.log(`  → Done`);

  // ── Notifications ─────────────────────────────────────────────────────────
  console.log("\n🔔 Notifications:");
  let notifStats = { inserted: 0, failed: 0 };
  for (const n of NOTIFICATIONS) {
    try {
      const res = await fetch(`${BASE}/api/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Account-Id": "acc-hr-demo",
          "X-Account-Role": "hr",
        },
        body: JSON.stringify({
          id: n.id,
          account_id: n.accountId,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          is_read: n.isRead || false,
          created_by: "acc-hr-demo",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && !body.error?.includes("duplicate")) throw new Error(body.error || res.status);
      notifStats.inserted++;
      console.log(`  + ${n.id}: ${n.title}`);
    } catch (err) {
      notifStats.failed++;
      console.error(`  ✗ ${n.id}: ${err.message}`);
    }
  }
  console.log(`  → ${notifStats.inserted} inserted, ${notifStats.failed} failed`);

  console.log("\n✅ Backfill complete!\n");
}

main().catch((err) => {
  console.error("\n💥 Backfill failed:", err.message);
  process.exit(1);
});
