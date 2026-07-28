import { matchRoute } from "../../app/route-registry.js";
import { mountDataRoute, routeCopy } from "./data-route.js";

const resources = [
  { id: "security", title: "Information security", description: "Policies and practical guidance for protecting customer and company data.", status: "available" },
  { id: "conduct", title: "Professional conduct", description: "Internal standards for ethical and compliant securities operations.", status: "available" },
  { id: "support", title: "Learning support", description: "Contact HR/L&D through the account support channel when training access is blocked.", status: "available" },
];

const gallery = [];

const configs = {
  "/dashboard/learning-paths": { copy: routeCopy("Lộ trình học", "Learning paths", "학습 경로", "Theo dõi lộ trình được giao và bước tiếp theo."), load: (api, _params, signal) => api("/api/learning-paths/my", { signal }), mapItem: (item) => ({ title: item.title || item.learningPath?.title || item.id, subtitle: item.description || item.learningPath?.description || "", status: item.status || "", meta: `${Number(item.progressPercent || item.progress_percent || 0)}%`, href: `/dashboard/learning-paths/${encodeURIComponent(item.id)}` }) },
  "/dashboard/learning-paths/:id": { copy: routeCopy("Chi tiết lộ trình", "Learning path detail", "학습 경로 상세", "Tiến độ và các bước của lộ trình."), load: (api, params, signal) => api(`/api/learning-paths/my/${encodeURIComponent(params.id)}`, { signal }) },
  "/dashboard/gallery": { copy: routeCopy("Thư viện ảnh", "Gallery", "갤러리", "Album đào tạo đã được công bố."), data: { items: gallery } },
  "/dashboard/gallery/:id": { copy: routeCopy("Album đào tạo", "Training album", "교육 앨범", "Chi tiết album đào tạo."), data: { title: "Training album", status: "empty" } },
  "/dashboard/resources": { copy: routeCopy("Tài nguyên", "Resources", "자료", "Tài liệu tham khảo dùng chung cho nhân viên."), data: { items: resources }, mapItem: (item) => ({ title: item.title, subtitle: item.description, status: item.status }) },
  "/dashboard/calendar": { copy: routeCopy("Lịch học", "Learning calendar", "학습 일정", "Deadline khóa học và lịch đào tạo sắp tới."), load: async (api, _params, signal) => { const [calendar, enrollments] = await Promise.all([api("/api/training/calendar", { signal }), api("/api/enrollments", { signal })]); return { items: [...(calendar.items || calendar.sessions || calendar || []), ...(enrollments || [])] }; } },
  "/dashboard/learning-history": { copy: routeCopy("Lịch sử học tập", "Learning history", "학습 기록", "Hồ sơ hoàn thành và bằng chứng học tập của bạn."), load: (api, _params, signal) => api("/api/learning-history/me", { signal }) },
  "/dashboard/compliance": { copy: routeCopy("Đào tạo tuân thủ", "Compliance", "컴플라이언스 교육", "Nghĩa vụ tuân thủ, thời hạn và trạng thái hoàn thành."), load: (api, _params, signal) => api("/api/compliance/my", { signal }), mapItem: (item) => ({ title: item.program?.title || item.program?.name || item.cycle?.title || item.title || item.id, subtitle: item.cycle?.title || item.description || "", status: item.status || "", meta: item.dueAt || item.due_at || "", href: `/dashboard/compliance/${encodeURIComponent(item.id)}` }) },
  "/dashboard/compliance/:id": { copy: routeCopy("Chi tiết tuân thủ", "Compliance detail", "컴플라이언스 상세", "Yêu cầu, thời hạn và tài nguyên bắt buộc."), load: (api, params, signal) => api(`/api/compliance/my/${encodeURIComponent(params.id)}`, { signal }) },
  "/dashboard/skills": { copy: routeCopy("Kỹ năng của tôi", "My skills", "내 역량", "Mức năng lực hiện tại và khoảng trống cần phát triển."), load: (api, _params, signal) => api("/api/competencies/my", { signal }) },
  "/dashboard/development-plan": { copy: routeCopy("Kế hoạch phát triển", "Development plan", "개발 계획", "Mục tiêu và hoạt động phát triển cá nhân."), load: (api, _params, signal) => api("/api/development-plans/my", { signal }), mapItem: (item) => ({ title: item.title || item.name || item.id, subtitle: item.description || "", status: item.status || "", meta: item.dueAt || item.due_at || "", href: `/dashboard/development-plan/${encodeURIComponent(item.id)}` }) },
  "/dashboard/development-plan/:id": { copy: routeCopy("Chi tiết kế hoạch", "Plan detail", "계획 상세", "Mục tiêu, hoạt động và tiến độ thực hiện."), load: (api, params, signal) => api(`/api/development-plans/my/${encodeURIComponent(params.id)}`, { signal }) },
  "/dashboard/notifications": { copy: routeCopy("Thông báo", "Notifications", "알림", "Thông báo học tập và hành động cần xử lý."), load: (api, _params, signal) => api("/api/notifications", { signal }) },
};

export async function mount({ account, route = matchRoute(location.pathname) }) {
  const config = configs[route?.pattern || route?.path];
  if (!route || !config) throw new Error("LEARNER_ROUTE_CONFIG_MISSING");
  await mountDataRoute({ account, route, entry: `learner-secondary:${route.pattern || route.path}`, config });
}
