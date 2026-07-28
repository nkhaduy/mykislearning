import { mountCollectionRoute } from "../../shared/ui/collection-route.js";

const copy = {
  vi: { title: "Hồ sơ học tập & chứng chỉ", eyebrow: "Learning Records", intro: "Hồ sơ được tải theo scope quyền và không phụ thuộc global state.", search: "Tìm hồ sơ", refresh: "Làm mới", empty: "Chưa có hồ sơ.", error: "Không thể tải hồ sơ.", retry: "Thử lại", open: "Mở", restricted: "Bạn không có quyền xem hồ sơ." },
  en: { title: "Learning records & certificates", eyebrow: "Learning Records", intro: "Records load within the current authorization scope without global state.", search: "Search records", refresh: "Refresh", empty: "No records.", error: "Unable to load records.", retry: "Retry", open: "Open", restricted: "You cannot view records." },
  kr: { title: "학습 기록 및 자격증", eyebrow: "Learning Records", intro: "전역 상태 없이 권한 범위에 따라 기록을 불러옵니다.", search: "기록 검색", refresh: "새로고침", empty: "기록이 없습니다.", error: "기록을 불러올 수 없습니다.", retry: "다시 시도", open: "열기", restricted: "기록을 볼 권한이 없습니다." },
};

export async function mount({ account }) {
  const admin = account.role !== "employee";
  return mountCollectionRoute({ account, roles: ["employee", "hr", "admin"], entry: admin ? "learning-records" : "learner-certificates", endpoint: admin ? "/api/admin/learning-records" : "/api/certifications/me", itemKeys: ["items", "records", "certifications", "data"], copy, mapItem: (row) => ({ id: row.id, title: row.title || row.name || row.course_title || row.certificate_type || row.id, subtitle: row.employee?.fullName || row.employee_name || row.issuer || row.provider || "", status: row.status || row.verification_status || "recorded", meta: row.completed_at || row.issue_date || row.updated_at || "", href: "" }) });
}
