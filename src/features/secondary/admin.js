import { matchRoute } from "../../app/route-registry.js";
import { mountDataRoute, routeCopy } from "./data-route.js";
import { escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const gallery = [];

const assignmentForm = {
  render(data, text) {
    const employees = data?.employees || [];
    const courses = data?.courses || [];
    return `<form class="route-card secondary-form" data-assignment-form><h2>${escapeHtml(text.title)}</h2><div><label><span>Employee</span><select name="accountId" required><option value="">—</option>${employees.map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.fullName || item.full_name || item.email || item.id)}</option>`).join("")}</select></label><label><span>Course</span><select name="courseId" required><option value="">—</option>${courses.map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.title || item.data?.title || item.name || item.id)}</option>`).join("")}</select></label><label><span>Due date</span><input type="date" name="deadline"></label></div><button class="route-button" type="submit">Assign course</button><p role="status" data-assignment-status></p></form>`;
  },
  bind({ root, apiJson, announce }) {
    root.querySelector("[data-assignment-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = form.querySelector("[data-assignment-status]");
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      status.textContent = "Saving...";
      try {
        await apiJson("/api/enrollments", { method: "POST", body: JSON.stringify({ enrollments: [{ accountId: values.accountId, courseId: values.courseId, deadline: values.deadline || null, status: "notStarted" }] }) });
        status.textContent = "Assignment created.";
        announce("Assignment created.");
        form.reset();
      } catch (error) {
        status.textContent = error.code || "ASSIGNMENT_FAILED";
      } finally {
        button.disabled = false;
      }
    });
  },
};

const configs = {
  "/hr/assign": { copy: routeCopy("Giao khóa học", "Assignments", "과정 배정", "Giao khóa học cho nhân viên với thời hạn rõ ràng."), search: false, form: assignmentForm, load: async (api, _params, signal) => { const [employeesResult, coursesResult] = await Promise.all([api("/api/employees?pageSize=100", { signal }), api("/api/courses", { signal })]); return { employees: employeesResult.items || employeesResult.data || employeesResult || [], courses: coursesResult.items || coursesResult.data || coursesResult || [] }; }, items: () => [] },
  "/hr/learning-paths": { copy: routeCopy("Lộ trình học", "Learning paths", "학습 경로", "Thiết kế, xuất bản và theo dõi lộ trình học."), load: (api, _params, signal) => api("/api/admin/learning-paths", { signal }), mapItem: (item) => ({ title: item.title || item.name || item.id, subtitle: item.description || "", status: item.status || "", href: `/hr/learning-paths/${encodeURIComponent(item.id)}` }) },
  "/hr/learning-paths/:id": { copy: routeCopy("Chi tiết lộ trình", "Learning path detail", "학습 경로 상세", "Phiên bản, bước học và phạm vi phân công."), load: (api, params, signal) => api(`/api/admin/learning-paths/${encodeURIComponent(params.id)}`, { signal }) },
  "/hr/sessions": { copy: routeCopy("Lớp offline", "Offline classes", "오프라인 교육", "Lịch lớp, người tham gia và trạng thái điểm danh."), load: (api, _params, signal) => api("/api/training/sessions", { signal }) },
  "/hr/training-tracking": { copy: routeCopy("Theo dõi đào tạo", "Training tracking", "교육 추적", "Theo dõi hồ sơ đào tạo ngoài hệ thống."), load: (api, _params, signal) => api("/api/admin/training-tracking?pageSize=100", { signal }) },
  "/hr/cchn-registrations": { copy: routeCopy("Đăng ký học CCHN", "Certification registration", "자격 교육 등록", "Danh mục và đăng ký chương trình chứng chỉ hành nghề."), load: (api, _params, signal) => api("/api/admin/cchn/registrations?pageSize=100", { signal }) },
  "/hr/competencies": { copy: routeCopy("Khung năng lực", "Competencies", "역량 체계", "Danh mục năng lực, cấp độ và yêu cầu theo vai trò."), load: (api, _params, signal) => api("/api/admin/competencies", { signal }) },
  "/hr/skills-matrix": { copy: routeCopy("Ma trận kỹ năng", "Skills matrix", "역량 매트릭스", "Khoảng trống năng lực theo nhân viên và phòng ban."), load: (api, _params, signal) => api("/api/admin/skills-matrix?pageSize=100", { signal }) },
  "/hr/development-plans": { copy: routeCopy("Kế hoạch phát triển", "Development plans", "개발 계획", "Kế hoạch phát triển, mục tiêu và trạng thái phê duyệt."), load: (api, _params, signal) => api("/api/admin/development-plans", { signal }) },
  "/hr/retraining": { copy: routeCopy("Tái đào tạo", "Retraining", "재교육", "Các trường hợp cần tái đào tạo từ khoảng trống năng lực hoặc nội dung thay đổi."), load: (api, _params, signal) => api("/api/admin/retraining-reviews", { signal }) },
  "/hr/compliance": { copy: routeCopy("Tuân thủ", "Compliance", "컴플라이언스", "Chương trình, chu kỳ và ngoại lệ tuân thủ."), load: async (api, _params, signal) => { const [overview, programs, cycles] = await Promise.all([api("/api/admin/compliance/overview", { signal }), api("/api/admin/compliance/programs", { signal }), api("/api/admin/compliance/cycles", { signal })]); return { overview, items: cycles.cycles || cycles.items || cycles.data || cycles || [], programs }; }, mapItem: (item) => ({ title: item.title || item.name || item.id, subtitle: item.description || item.cycleCode || item.cycle_code || "", status: item.status || "", meta: item.dueAt || item.due_at || "", href: `/hr/compliance/cycles/${encodeURIComponent(item.id)}` }) },
  "/hr/compliance/cycles/:id": { copy: routeCopy("Chu kỳ tuân thủ", "Compliance cycle", "컴플라이언스 주기", "Phạm vi, thời hạn và danh sách phân công của chu kỳ."), load: (api, params, signal) => api(`/api/admin/compliance/cycles/${encodeURIComponent(params.id)}/assignments`, { signal }) },
  "/hr/certificates": { copy: routeCopy("Chứng chỉ", "Certificates", "자격증", "Trạng thái xác minh, sắp hết hạn và chứng chỉ còn thiếu."), load: (api, _params, signal) => api("/api/admin/certificates?pageSize=100", { signal }) },
  "/hr/gallery": { copy: routeCopy("Thư viện ảnh", "Gallery", "갤러리", "Album đào tạo được quản trị trên hệ thống."), data: { items: gallery } },
  "/hr/notifications": { copy: routeCopy("Thông báo", "Notifications", "알림", "Giám sát phân phối thông báo và reminder."), load: (api, _params, signal) => api("/api/admin/notifications/monitor", { signal }) },
  "/hr/audit-log": { copy: routeCopy("Nhật ký kiểm toán", "Audit log", "감사 로그", "Sự kiện nhạy cảm, actor và correlation ID."), load: (api, _params, signal) => api("/api/admin/audit-logs?pageSize=100", { signal }) },
};

export async function mount({ account, route = matchRoute(location.pathname) }) {
  const config = configs[route?.pattern || route?.path];
  if (!route || !config) throw new Error("ADMIN_ROUTE_CONFIG_MISSING");
  await mountDataRoute({ account, route, entry: `admin-secondary:${route.pattern || route.path}`, config });
}
