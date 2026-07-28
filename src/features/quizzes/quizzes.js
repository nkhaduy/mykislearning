import { mountCollectionRoute } from "../../shared/ui/collection-route.js";

const copy = {
  vi: { title: "Bài kiểm tra", eyebrow: "Assessment", intro: "Danh sách quiz được tải theo quyền hiện tại.", search: "Tìm bài kiểm tra", refresh: "Làm mới", empty: "Chưa có bài kiểm tra.", error: "Không thể tải bài kiểm tra.", retry: "Thử lại", open: "Mở", restricted: "Bạn không có quyền xem bài kiểm tra." },
  en: { title: "Quizzes", eyebrow: "Assessment", intro: "Quiz data loads for the current permission scope.", search: "Search quizzes", refresh: "Refresh", empty: "No quizzes.", error: "Unable to load quizzes.", retry: "Retry", open: "Open", restricted: "You cannot view quizzes." },
  kr: { title: "퀴즈", eyebrow: "Assessment", intro: "현재 권한 범위에 맞게 퀴즈를 불러옵니다.", search: "퀴즈 검색", refresh: "새로고침", empty: "퀴즈가 없습니다.", error: "퀴즈를 불러올 수 없습니다.", retry: "다시 시도", open: "열기", restricted: "퀴즈를 볼 권한이 없습니다." },
};

export async function mount({ account }) {
  const admin = account.role !== "employee";
  return mountCollectionRoute({ account, roles: ["employee", "hr", "admin"], entry: admin ? "quiz-management" : "quiz-player", endpoint: "/api/quizzes", itemKeys: ["items", "data"], copy, mapItem: (row) => { const data = row.data || row; return { id: row.id, title: data.title || data.name || row.id, subtitle: data.description || "", status: row.status || data.status || "draft", meta: data.timeLimitMinutes ? `${data.timeLimitMinutes} min` : "", href: admin ? "" : `/dashboard/quizzes?quiz=${encodeURIComponent(row.id)}` }; } });
}
