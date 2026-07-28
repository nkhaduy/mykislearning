import { mountCollectionRoute } from "../../shared/ui/collection-route.js";

const copy = {
  vi: { title: "Đào tạo trực tiếp", eyebrow: "Live Training", intro: "Quản lý hành trình buổi học mà không tải ứng dụng legacy.", search: "Tìm buổi học", refresh: "Làm mới", empty: "Chưa có buổi học.", error: "Không thể tải buổi học.", retry: "Thử lại", open: "Mở chi tiết", restricted: "Bạn không có quyền quản lý đào tạo." },
  en: { title: "Live training", eyebrow: "Live Training", intro: "Manage live-session journeys without loading the legacy application.", search: "Search sessions", refresh: "Refresh", empty: "No live sessions.", error: "Unable to load sessions.", retry: "Retry", open: "Open details", restricted: "You cannot manage training." },
  kr: { title: "실시간 교육", eyebrow: "Live Training", intro: "레거시 앱 없이 실시간 교육 흐름을 관리합니다.", search: "세션 검색", refresh: "새로고침", empty: "세션이 없습니다.", error: "세션을 불러올 수 없습니다.", retry: "다시 시도", open: "상세 보기", restricted: "교육 관리 권한이 없습니다." },
};

export async function mount({ account }) {
  return mountCollectionRoute({ account, roles: ["hr", "admin"], entry: "live-training", endpoint: "/api/admin/live-training", itemKeys: ["flows", "items", "data"], copy, mapItem: (row) => ({ id: row.id, title: row.title || row.session_title || row.name || row.id, subtitle: row.description || row.location_name || row.public_slug || "", status: row.status || row.state || "draft", meta: row.start_at || row.created_at || "", href: `/admin/live-training/${encodeURIComponent(row.id)}` }) });
}
