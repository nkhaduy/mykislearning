const STORAGE_LANG = "mykis-language";
const supportedLanguages = ["vi", "en", "kr"];
let currentLang = localStorage.getItem(STORAGE_LANG) || "vi";
if (!supportedLanguages.includes(currentLang)) currentLang = "vi";

const t = {
  vi: {
    welcome: "Chào mừng đến với",
    employeeOnly: "Dành riêng cho nhân viên KIS Việt Nam",
    heroSubtitle: "Hệ thống Đào tạo Hội nhập và Phát triển chuyên môn KIS Việt Nam",
    heroDescription: "Nơi lưu trữ tài liệu, khóa học kỹ năng mềm, chuyên môn và kiểm tra tiến độ; giúp nhân viên nhanh chóng hòa nhập và nâng cao năng lực làm việc.",
    loginSystem: "Đăng nhập hệ thống",
    viewCourses: "Xem các khóa đào tạo",
    purposeTitle: "Mục đích của hệ thống",
    purposeSubtitle: "MyKIS Learning tập trung hóa hoạt động đào tạo nội bộ, giúp nhân viên tiếp cận tri thức đúng lúc và HR theo dõi hiệu quả phát triển năng lực.",
    statsTitle: "MyKIS Learning trong những con số",
    statsSubtitle: "Tổng quan hoạt động đào tạo và phát triển nhân sự tại KIS Việt Nam.",
    totalEmployees: "Tổng số nhân viên đã tham gia",
    totalCourses: "Số lượng khóa đào tạo",
    totalHours: "Tổng số giờ học",
    featuredCourses: "Khóa đào tạo nổi bật",
    featuredSubtitle: "Những chương trình đào tạo đã được triển khai nhằm nâng cao năng lực lãnh đạo, giao tiếp và hiệu quả làm việc.",
    upcomingCourses: "Khóa học sắp diễn ra",
    upcomingSubtitle: "Cập nhật các chương trình đào tạo dự kiến trong thời gian tới.",
    hrAnnouncements: "Thông báo từ HR",
    hrSubtitle: "Cập nhật các thông tin quan trọng về đào tạo, hội nhập và phát triển nhân sự.",
    viewDetail: "Xem chi tiết",
    viewInfo: "Xem thông tin",
    viewAll: "Xem tất cả thông báo",
    occurred: "Đã diễn ra",
    category: "Danh mục",
    audience: "Đối tượng",
    format: "Hình thức",
    expected: "Dự kiến Quý III/2026",
    new: "Mới",
    aboutKis: "Về KIS",
    footerDesc: "Hệ thống đào tạo nội bộ dành cho nhân viên KIS Việt Nam",
    cchnTitle: "Danh sách nhân viên sở hữu Chứng chỉ hành nghề",
    cchnSubtitle: "Ghi nhận những cá nhân đã hoàn thành các yêu cầu chuyên môn và góp phần nâng cao năng lực đội ngũ KIS Việt Nam.",
    searchName: "Tìm kiếm theo tên",
    sortAZ: "Sắp xếp A-Z",
    coreTitle: "Giá trị cốt lõi & Sứ mệnh",
    coreSubtitle: "Định hướng cách KIS xây dựng tổ chức, thúc đẩy đổi mới và tạo ra giá trị bền vững cho khách hàng.",
    philosophyTitle: "Triết lý tập đoàn",
    philosophySubtitle: "KIS hướng đến một môi trường làm việc chuyên nghiệp, kỷ luật và luôn đổi mới để đồng hành cùng khách hàng trên thị trường tài chính.",
  },
  en: {
    welcome: "Welcome to",
    employeeOnly: "Exclusively for KIS Vietnam employees",
    heroSubtitle: "KIS Vietnam onboarding and professional development learning system",
    heroDescription: "A place to store documents, soft-skill courses, professional learning and progress checks, helping employees onboard quickly and strengthen work capabilities.",
    loginSystem: "Log in",
    viewCourses: "View training courses",
    purposeTitle: "System purpose",
    purposeSubtitle: "MyKIS Learning centralizes internal training so employees can access the right knowledge on time and HR can track capability development more effectively.",
    statsTitle: "MyKIS Learning in numbers",
    statsSubtitle: "An overview of training and people development activity at KIS Vietnam.",
    totalEmployees: "Total participating employees",
    totalCourses: "Total training courses",
    totalHours: "Total learning hours",
    featuredCourses: "Featured training courses",
    featuredSubtitle: "Training programs delivered to improve leadership, communication and work effectiveness.",
    upcomingCourses: "Upcoming courses",
    upcomingSubtitle: "Updates on planned training programs in the coming period.",
    hrAnnouncements: "HR announcements",
    hrSubtitle: "Important updates on training, onboarding and people development.",
    viewDetail: "View details",
    viewInfo: "View information",
    viewAll: "View all announcements",
    occurred: "Completed",
    category: "Category",
    audience: "Audience",
    format: "Format",
    expected: "Expected Q3/2026",
    new: "New",
    aboutKis: "About KIS",
    footerDesc: "Internal training system for KIS Vietnam employees",
    cchnTitle: "Employees holding professional securities certificates",
    cchnSubtitle: "Recognizing individuals who have completed professional requirements and contribute to strengthening KIS Vietnam's workforce capability.",
    searchName: "Search by name",
    sortAZ: "Sort A-Z",
    coreTitle: "Core Values & Mission",
    coreSubtitle: "Guiding how KIS builds its organization, drives transformation, and creates sustainable value for customers.",
    philosophyTitle: "Group philosophy",
    philosophySubtitle: "KIS aims to build a professional, disciplined and continuously improving workplace to accompany customers in the financial market.",
  },
  kr: {
    welcome: "MyKIS Learning에 오신 것을 환영합니다",
    employeeOnly: "KIS 베트남 임직원 전용",
    heroSubtitle: "KIS 베트남 온보딩 및 전문 역량 개발 학습 시스템",
    heroDescription: "자료, 소프트 스킬 과정, 전문 교육 및 학습 진행 점검을 한곳에 모아 임직원의 빠른 적응과 업무 역량 향상을 지원합니다.",
    loginSystem: "로그인",
    viewCourses: "교육 과정 보기",
    purposeTitle: "시스템 목적",
    purposeSubtitle: "MyKIS Learning은 사내 교육을 통합하여 임직원이 필요한 지식에 적시에 접근하고 HR이 역량 개발 효과를 추적할 수 있도록 지원합니다.",
    statsTitle: "MyKIS Learning 주요 지표",
    statsSubtitle: "KIS 베트남의 교육 및 인재 개발 활동 개요입니다.",
    totalEmployees: "교육 참여 임직원 수",
    totalCourses: "전체 교육 과정 수",
    totalHours: "총 학습 시간",
    featuredCourses: "주요 교육 과정",
    featuredSubtitle: "리더십, 커뮤니케이션 및 업무 효율 향상을 위해 진행된 교육 프로그램입니다.",
    upcomingCourses: "예정 교육 과정",
    upcomingSubtitle: "향후 예정된 교육 프로그램을 업데이트합니다.",
    hrAnnouncements: "HR 공지사항",
    hrSubtitle: "교육, 온보딩 및 인재 개발 관련 주요 안내입니다.",
    viewDetail: "자세히 보기",
    viewInfo: "정보 보기",
    viewAll: "전체 공지 보기",
    occurred: "진행 완료",
    category: "카테고리",
    audience: "대상",
    format: "형태",
    expected: "2026년 3분기 예정",
    new: "신규",
    aboutKis: "KIS 소개",
    footerDesc: "KIS 베트남 임직원을 위한 사내 교육 시스템",
    cchnTitle: "전문 자격증 보유 임직원 명단",
    cchnSubtitle: "전문 요건을 충족하고 KIS 베트남 조직 역량 강화에 기여한 구성원을 인정합니다.",
    searchName: "이름 검색",
    sortAZ: "A-Z 정렬",
    coreTitle: "핵심 가치 및 미션",
    coreSubtitle: "KIS가 조직을 구축하고 변화를 추진하며 고객을 위한 지속 가능한 가치를 창출하는 방향을 제시합니다.",
    philosophyTitle: "그룹 철학",
    philosophySubtitle: "KIS는 전문적이고 규율 있는 업무 환경과 지속적인 혁신을 통해 금융 시장에서 고객과 함께 성장합니다.",
  },
};

const trainingCourses = [
  { id: "leadership", name: "Leadership Training Course", viName: "Khóa đào tạo Kỹ năng Lãnh đạo", krName: "리더십 교육 과정", category: "Leadership Development", status: "Đã diễn ra", audience: "Cấp quản lý", format: "Đào tạo trực tiếp", durationHours: 16, image: "/images/leadership-training-course.png", description: "Chương trình phát triển năng lực lãnh đạo, quản lý đội ngũ, ra quyết định và thúc đẩy hiệu suất làm việc.", date: "Đã tổ chức trong năm 2026" },
  { id: "communication", name: "Communication Training Course", viName: "Khóa đào tạo Kỹ năng Giao tiếp", krName: "커뮤니케이션 교육 과정", category: "Soft Skills", status: "Đã diễn ra", audience: "Nhân viên KIS Việt Nam", format: "Offline kết hợp trực tuyến", durationHours: 12, image: "/images/communication-training-course.png", description: "Chương trình thực hành kỹ năng giao tiếp, lắng nghe, phản hồi, phối hợp nội bộ và trao đổi với khách hàng.", date: "Đã tổ chức trong năm 2026" },
  { id: "securities-basic", name: "Kiến thức chứng khoán cơ bản", category: "Chuyên môn", status: "Sắp mở đăng ký", format: "Trực tuyến", durationHours: 10, image: "/images/mykis-learning-hero.png", expectedTime: "Dự kiến Quý III/2026" },
  { id: "broker-certificate", name: "Ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", category: "Chứng chỉ chuyên môn", status: "Sắp diễn ra", format: "Kết hợp", durationHours: 18, image: "/images/leadership-training-course.png", expectedTime: "Dự kiến Quý III/2026" },
  { id: "excel-reporting", name: "Excel nâng cao cho báo cáo", category: "Công cụ làm việc", status: "Đang lên kế hoạch", format: "Trực tiếp", durationHours: 8, image: "/images/communication-training-course.png", expectedTime: "Dự kiến Quý III/2026" },
  { id: "reporting-skill", name: "Kỹ năng báo cáo và trình bày vấn đề", category: "Kỹ năng mềm", status: "Sắp mở đăng ký", format: "Trực tuyến", durationHours: 6, image: "/images/mykis-learning-hero.png", expectedTime: "Dự kiến Quý III/2026" },
];

const allTrainingCourses = [
  ...trainingCourses,
  ...Array.from({ length: 26 }, (_, index) => ({
    id: `archive-course-${index + 1}`,
    name: `KIS training archive ${index + 1}`,
    category: "Internal Training",
    durationHours: 2,
  })),
];

const enrollments = [
  { employeeId: "E001", courseId: "leadership", trainingHours: 16 },
  { employeeId: "E002", courseId: "communication", trainingHours: 12 },
  { employeeId: "E003", courseId: "communication", trainingHours: 12 },
  { employeeId: "E004", courseId: "leadership", trainingHours: 16 },
  { employeeId: "E001", courseId: "communication", trainingHours: 12 },
  ...Array.from({ length: 424 }, (_, index) => ({
    employeeId: `ED${String(index + 1).padStart(3, "0")}`,
    courseId: index % 2 ? "communication" : "leadership",
    trainingHours: index < 54 ? 2 : 3,
  })),
];

const announcements = [
  { id: "a1", title: "Lịch đào tạo hội nhập dành cho nhân viên mới", description: "Nhân viên mới vui lòng hoàn thành các nội dung đào tạo hội nhập bắt buộc theo thời hạn được giao.", category: "Onboarding", publishDate: "Cập nhật mới", isPinned: true, status: "published", createdBy: "HR" },
  { id: "a2", title: "Kế hoạch ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", description: "HR sẽ cập nhật tài liệu, lịch ôn tập và danh sách nhân viên tham gia trong thời gian tới.", category: "Chứng chỉ chuyên môn", publishDate: "Cập nhật mới", isPinned: false, status: "published", createdBy: "HR" },
  { id: "a3", title: "Cập nhật tài liệu Communication Training", description: "Tài liệu đào tạo và nội dung thực hành đã được cập nhật trên MyKIS Learning.", category: "Kỹ năng mềm", publishDate: "Cập nhật mới", isPinned: false, status: "published", createdBy: "L&D" },
  { id: "a4", title: "Nhắc hoàn thành bài kiểm tra sau đào tạo", description: "Nhân viên vui lòng kiểm tra deadline và hoàn thành bài đánh giá đúng thời hạn.", category: "Đánh giá", publishDate: "Cập nhật mới", isPinned: false, status: "published", createdBy: "HR" },
];

const localizedText = {
  leadership: {
    description: {
      vi: "Chương trình phát triển năng lực lãnh đạo, quản lý đội ngũ, ra quyết định và thúc đẩy hiệu suất làm việc.",
      en: "A program to develop leadership capability, team management, decision-making and performance enablement.",
      kr: "리더십 역량, 팀 관리, 의사결정 및 성과 향상을 개발하는 프로그램입니다.",
    },
    audience: { vi: "Cấp quản lý", en: "Management level", kr: "관리자급" },
    format: { vi: "Đào tạo trực tiếp", en: "In-person training", kr: "대면 교육" },
    date: { vi: "Đã tổ chức trong năm 2026", en: "Delivered in 2026", kr: "2026년 진행 완료" },
  },
  communication: {
    description: {
      vi: "Chương trình thực hành kỹ năng giao tiếp, lắng nghe, phản hồi, phối hợp nội bộ và trao đổi với khách hàng.",
      en: "A practical program for communication, listening, feedback, internal collaboration and customer conversations.",
      kr: "커뮤니케이션, 경청, 피드백, 내부 협업 및 고객 응대 역량을 실습하는 프로그램입니다.",
    },
    audience: { vi: "Nhân viên KIS Việt Nam", en: "KIS Vietnam employees", kr: "KIS 베트남 임직원" },
    format: { vi: "Offline kết hợp trực tuyến", en: "Offline and online blended", kr: "오프라인 및 온라인 병행" },
    date: { vi: "Đã tổ chức trong năm 2026", en: "Delivered in 2026", kr: "2026년 진행 완료" },
  },
};

const upcomingI18n = {
  "securities-basic": {
    name: { vi: "Kiến thức chứng khoán cơ bản", en: "Securities fundamentals", kr: "증권 기초 지식" },
    category: { vi: "Chuyên môn", en: "Professional knowledge", kr: "전문 지식" },
    format: { vi: "Trực tuyến", en: "Online", kr: "온라인" },
    status: { vi: "Sắp mở đăng ký", en: "Registration opening soon", kr: "곧 신청 오픈" },
  },
  "broker-certificate": {
    name: { vi: "Ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", en: "Brokerage professional certificate review", kr: "증권중개 전문 자격 대비" },
    category: { vi: "Chứng chỉ chuyên môn", en: "Professional certificate", kr: "전문 자격" },
    format: { vi: "Kết hợp", en: "Blended", kr: "혼합형" },
    status: { vi: "Sắp diễn ra", en: "Upcoming", kr: "진행 예정" },
  },
  "excel-reporting": {
    name: { vi: "Excel nâng cao cho báo cáo", en: "Advanced Excel for reporting", kr: "보고서를 위한 고급 Excel" },
    category: { vi: "Công cụ làm việc", en: "Work tools", kr: "업무 도구" },
    format: { vi: "Trực tiếp", en: "In-person", kr: "대면" },
    status: { vi: "Đang lên kế hoạch", en: "Planning", kr: "계획 중" },
  },
  "reporting-skill": {
    name: { vi: "Kỹ năng báo cáo và trình bày vấn đề", en: "Reporting and issue presentation skills", kr: "보고 및 이슈 발표 역량" },
    category: { vi: "Kỹ năng mềm", en: "Soft skills", kr: "소프트 스킬" },
    format: { vi: "Trực tuyến", en: "Online", kr: "온라인" },
    status: { vi: "Sắp mở đăng ký", en: "Registration opening soon", kr: "곧 신청 오픈" },
  },
};

const announcementI18n = {
  a1: {
    title: { vi: "Lịch đào tạo hội nhập dành cho nhân viên mới", en: "Onboarding training schedule for new employees", kr: "신입 임직원 온보딩 교육 일정" },
    description: { vi: "Nhân viên mới vui lòng hoàn thành các nội dung đào tạo hội nhập bắt buộc theo thời hạn được giao.", en: "New employees are requested to complete mandatory onboarding content by the assigned deadline.", kr: "신입 임직원은 지정된 기한 내 필수 온보딩 과정을 완료해 주시기 바랍니다." },
    category: { vi: "Onboarding", en: "Onboarding", kr: "온보딩" },
  },
  a2: {
    title: { vi: "Kế hoạch ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", en: "Brokerage professional certificate review plan", kr: "증권중개 전문 자격 대비 계획" },
    description: { vi: "HR sẽ cập nhật tài liệu, lịch ôn tập và danh sách nhân viên tham gia trong thời gian tới.", en: "HR will update materials, review schedules and participant lists in the coming period.", kr: "HR은 향후 자료, 복습 일정 및 참여자 명단을 업데이트할 예정입니다." },
    category: { vi: "Chứng chỉ chuyên môn", en: "Professional certificate", kr: "전문 자격" },
  },
  a3: {
    title: { vi: "Cập nhật tài liệu Communication Training", en: "Communication Training materials updated", kr: "커뮤니케이션 교육 자료 업데이트" },
    description: { vi: "Tài liệu đào tạo và nội dung thực hành đã được cập nhật trên MyKIS Learning.", en: "Training materials and practice content have been updated on MyKIS Learning.", kr: "교육 자료와 실습 콘텐츠가 MyKIS Learning에 업데이트되었습니다." },
    category: { vi: "Kỹ năng mềm", en: "Soft skills", kr: "소프트 스킬" },
  },
  a4: {
    title: { vi: "Nhắc hoàn thành bài kiểm tra sau đào tạo", en: "Reminder to complete post-training assessments", kr: "교육 후 평가 완료 안내" },
    description: { vi: "Nhân viên vui lòng kiểm tra deadline và hoàn thành bài đánh giá đúng thời hạn.", en: "Employees are requested to check deadlines and complete assessments on time.", kr: "임직원은 마감일을 확인하고 평가를 기한 내 완료해 주시기 바랍니다." },
    category: { vi: "Đánh giá", en: "Assessment", kr: "평가" },
  },
};

const cchnNames = [
  "Nguyễn Minh Châu", "Trần Quốc Huy", "Lê Thảo Nguyên", "Phạm Hoàng Nam", "Đỗ Khánh Linh", "Võ Anh Tuấn",
  "Bùi Thanh Hà", "Nguyễn Gia Bảo", "Trương Mỹ Duyên", "Hoàng Việt Anh", "Mai Phương Chi", "Đặng Quang Minh",
];

function getTotalParticipatingEmployees(data = enrollments) {
  return new Set(data.filter((item) => item.employeeId).map((item) => item.employeeId)).size;
}

function getTotalTrainingCourses(data = allTrainingCourses) {
  return data.filter((course) => course.id && course.name).length;
}

function getTotalLearningHours(data = enrollments) {
  return data.reduce((total, item) => total + Number(item.trainingHours || item.durationHours || 0), 0);
}

const app = document.getElementById("app");

function translate(key) {
  return t[currentLang][key] || t.vi[key] || key;
}

function pickLocalized(value, fallback = "") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value[currentLang] || value.vi || value.en || fallback;
}

function pathFor(assetPath) {
  return assetPath;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(STORAGE_LANG, lang);
  render();
}

function icon(name) {
  const icons = {
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-5"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M15 9l5-5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h4M6 22v-4H2"/></svg>',
    customer: '<svg viewBox="0 0 24 24"><path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3Z"/><path d="M8 13c2.2 0 4-1.8 4-4S10.2 5 8 5 4 6.8 4 9s1.8 4 4 4Z"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M14 18.5a5 5 0 0 1 8 2.5"/></svg>',
    certificate: '<svg viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V7z"/><path d="M14 2v5h5"/><path d="M8 10h8M8 14h5"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  };
  return `<span class="line-icon">${icons[name] || icons.book}</span>`;
}

function brand() {
  return `<a class="brand brand-new" href="/" data-route="home"><span class="brand-mark">KIS</span><span>KIS Training Center</span></a>`;
}

function LanguageSwitcher() {
  const labels = { vi: "VI", en: "EN", kr: "KR" };
  return `
    <div class="language-switcher" aria-label="Language switcher">
      ${supportedLanguages.map((lang, index) => `
        <button type="button" class="lang-item ${currentLang === lang ? "active" : ""}" data-lang="${lang}">${labels[lang]}</button>
        ${index < supportedLanguages.length - 1 ? '<span class="lang-separator">·</span>' : ""}
      `).join("")}
    </div>
  `;
}

function Header() {
  return `
    <header class="site-header">
      <div class="container site-header-inner">
        ${brand()}
        <nav class="site-nav" aria-label="Main navigation">
          <a href="/#purpose">Mục đích</a>
          <a href="/#featured-courses">${translate("featuredCourses")}</a>
          <a href="/#upcoming-courses">${translate("upcomingCourses")}</a>
          <a href="/#hr-announcements">${translate("hrAnnouncements")}</a>
          <a href="/about-kis" data-route="about">${translate("aboutKis")}</a>
        </nav>
        <div class="site-actions">
          ${LanguageSwitcher()}
          <button class="btn btn-primary" data-route="login">${translate("loginSystem")}</button>
        </div>
      </div>
    </header>
  `;
}

function HeroLearningVisual() {
  return `
    <div class="learning-visual reveal">
      <div class="visual-grid"></div>
      <img src="${pathFor("/images/mykis-learning-hero.png")}" alt="Nhân viên tham gia đào tạo nội bộ MyKIS Learning" />
      <div class="visual-chip top">${icon("book")}Leadership · Communication · Onboarding</div>
      <div class="visual-chip bottom">${icon("shield")}${translate("employeeOnly")}</div>
    </div>
  `;
}

function LandingHero() {
  const welcomeLine = currentLang === "kr"
    ? `<p class="welcome-kicker">${translate("welcome")}</p><h1>MyKIS Learning</h1>`
    : `<p class="welcome-kicker">${translate("welcome")}</p><h1>MyKIS Learning</h1>`;
  return `
    <section class="landing-hero">
      <div class="container landing-hero-grid">
        <div class="hero-copy reveal">
          ${welcomeLine}
          <h2>${translate("heroSubtitle")}</h2>
          <p>${translate("heroDescription")}</p>
          <div class="employee-only">${icon("shield")}<span>${translate("employeeOnly")}</span></div>
          <div class="hero-actions">
            <button class="btn btn-primary" data-route="login">${translate("loginSystem")}</button>
            <a class="btn btn-outline" href="#featured-courses" data-scroll-target="featured-courses">${translate("viewCourses")}</a>
          </div>
        </div>
        ${HeroLearningVisual()}
      </div>
    </section>
  `;
}

function PurposeSection() {
  return `
    <section class="landing-section purpose-section" id="purpose">
      <div class="container purpose-layout reveal">
        <div>
          <span class="section-kicker">MYKIS LEARNING</span>
          <h2>${translate("purposeTitle")}</h2>
        </div>
        <p>${translate("purposeSubtitle")}</p>
      </div>
    </section>
  `;
}

function TrainingStatsSection() {
  const stats = [
    { label: translate("totalEmployees"), value: getTotalParticipatingEmployees(), suffix: "+", iconName: "users" },
    { label: translate("totalCourses"), value: getTotalTrainingCourses(), suffix: "", iconName: "book" },
    { label: translate("totalHours"), value: getTotalLearningHours(), suffix: currentLang === "kr" ? " 시간" : " giờ", iconName: "clock" },
  ];
  return `
    <section class="landing-section ice" id="stats">
      <div class="container">
        <div class="landing-section-head reveal">
          <span class="section-kicker">Training Analytics</span>
          <h2>${translate("statsTitle")}</h2>
          <p>${translate("statsSubtitle")}</p>
        </div>
        <div class="stats-grid">
          ${stats.map((stat) => `
            <article class="stat-card reveal">
              ${icon(stat.iconName)}
              <span>${stat.label}</span>
              <strong data-countup="${stat.value}" data-suffix="${stat.suffix}">0${stat.suffix}</strong>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function FeaturedCourseCard(course) {
  const local = localizedText[course.id] || {};
  return `
    <article class="featured-course-card reveal">
      <div class="course-image">
        <img src="${course.image}" alt="${course.viName}" />
        <span class="course-status">${translate("occurred")}</span>
      </div>
      <div class="course-body">
        <span class="course-category">${course.category}</span>
        <h3>${course.name}</h3>
        <p class="course-local-name">${course.viName}</p>
        <p class="course-kr-name">${course.krName}</p>
        <p>${pickLocalized(local.description, course.description)}</p>
        <dl class="course-meta">
          <div><dt>${translate("audience")}</dt><dd>${pickLocalized(local.audience, course.audience)}</dd></div>
          <div><dt>${translate("format")}</dt><dd>${pickLocalized(local.format, course.format)}</dd></div>
        </dl>
        <div class="course-footer">
          <span>${pickLocalized(local.date, course.date)}</span>
          <button class="btn btn-outline">${translate("viewDetail")}</button>
        </div>
      </div>
    </article>
  `;
}

function FeaturedCoursesSection() {
  return `
    <section class="landing-section" id="featured-courses">
      <div class="container">
        <div class="landing-section-head reveal">
          <span class="section-kicker">Completed Programs</span>
          <h2>${translate("featuredCourses")}</h2>
          <p>${translate("featuredSubtitle")}</p>
        </div>
        <div class="featured-grid">
          ${trainingCourses.slice(0, 2).map(FeaturedCourseCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function UpcomingCourseCard(course) {
  const local = upcomingI18n[course.id] || {};
  return `
    <article class="upcoming-card reveal">
      <img src="${course.image}" alt="${pickLocalized(local.name, course.name)}" />
      <div class="upcoming-body">
        <span class="course-category">${pickLocalized(local.category, course.category)}</span>
        <h3>${pickLocalized(local.name, course.name)}</h3>
        <div class="upcoming-meta">
          <span>${translate("expected")}</span>
          <span>${pickLocalized(local.format, course.format)}</span>
        </div>
        <span class="soft-status">${pickLocalized(local.status, course.status)}</span>
        <button class="btn btn-outline">${translate("viewInfo")}</button>
      </div>
    </article>
  `;
}

function UpcomingCoursesSection() {
  return `
    <section class="landing-section ice" id="upcoming-courses">
      <div class="container">
        <div class="landing-section-head reveal">
          <span class="section-kicker">Training Roadmap</span>
          <h2>${translate("upcomingCourses")}</h2>
          <p>${translate("upcomingSubtitle")}</p>
        </div>
        <div class="upcoming-scroller">
          ${trainingCourses.slice(2).map(UpcomingCourseCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function HRAnnouncementCard(item, featured = false) {
  const local = announcementI18n[item.id] || {};
  return `
    <article class="announcement-card ${featured ? "featured" : ""} reveal">
      <div class="announcement-top">
        <span class="announcement-category">${pickLocalized(local.category, item.category)}</span>
        ${item.isPinned ? `<span class="new-pill">${translate("new")}</span>` : ""}
      </div>
      <h3>${pickLocalized(local.title, item.title)}</h3>
      <p>${pickLocalized(local.description, item.description)}</p>
      <div class="announcement-footer">
        <span>${item.publishDate}</span>
        <button class="text-button">${translate("viewDetail")}</button>
      </div>
    </article>
  `;
}

function HRAnnouncementsSection() {
  const [featured, ...rest] = announcements;
  return `
    <section class="landing-section" id="hr-announcements">
      <div class="container">
        <div class="landing-section-head reveal">
          <span class="section-kicker">${icon("bell")} HR Updates</span>
          <h2>${translate("hrAnnouncements")}</h2>
          <p>${translate("hrSubtitle")}</p>
        </div>
        <div class="announcement-layout">
          ${HRAnnouncementCard(featured, true)}
          <div class="announcement-list">
            ${rest.map((item) => HRAnnouncementCard(item)).join("")}
          </div>
        </div>
        <div class="announcement-more reveal"><button class="btn btn-outline">${translate("viewAll")}</button></div>
      </div>
    </section>
  `;
}

function Footer() {
  return `
    <footer class="footer">
      <div class="container footer-inner">
        <div>
          <strong>KIS Training Center - Internal Use Only</strong>
          <p>${translate("footerDesc")}</p>
          <p>Prototype UI for internal training system</p>
        </div>
        <div class="footer-links">
          <a href="#">Chính sách bảo mật</a>
          <a href="#">Hỗ trợ</a>
          <a href="#">Liên hệ HR</a>
        </div>
      </div>
    </footer>
  `;
}

function LandingPage() {
  return `
    <div class="page new-landing">
      ${Header()}
      ${LandingHero()}
      ${PurposeSection()}
      ${TrainingStatsSection()}
      ${FeaturedCoursesSection()}
      ${UpcomingCoursesSection()}
      ${HRAnnouncementsSection()}
      ${Footer()}
    </div>
  `;
}

function CoreValueCard(item, index) {
  return `
    <article class="core-card reveal">
      <div class="core-index">${String(index + 1).padStart(2, "0")}</div>
      ${icon(item.iconName)}
      <h3>${item.title[currentLang]}</h3>
      <p>${item.description[currentLang]}</p>
    </article>
  `;
}

function CoreValuesMissionSection() {
  const values = [
    {
      iconName: "target",
      title: { vi: "Tổ chức hướng đến mục tiêu", en: "Goal-Oriented Organization", kr: "목표 지향적 조직" },
      description: {
        vi: "Xác lập mục tiêu rõ ràng, phối hợp hiệu quả và tập trung nguồn lực để tạo ra kết quả đo lường được.",
        en: "Setting clear objectives, coordinating effectively, and focusing resources to deliver measurable results.",
        kr: "명확한 목표를 설정하고 효과적으로 협업하며 자원을 집중하여 측정 가능한 성과를 창출합니다.",
      },
    },
    {
      iconName: "refresh",
      title: { vi: "Tổ chức thúc đẩy chuyển đổi", en: "A Transformative Organization", kr: "변화를 주도하는 조직" },
      description: {
        vi: "Không ngừng đổi mới phương thức làm việc, ứng dụng công nghệ và phát triển năng lực để thích ứng với thay đổi.",
        en: "Continuously improving ways of working, adopting technology, and building capabilities to adapt to change.",
        kr: "업무 방식을 지속적으로 개선하고 기술을 도입하며 변화에 대응할 수 있는 역량을 강화합니다.",
      },
    },
    {
      iconName: "customer",
      title: { vi: "Công ty lấy khách hàng làm trọng tâm", en: "A Customer-Focused Company", kr: "고객 중심 기업" },
      description: {
        vi: "Thấu hiểu nhu cầu khách hàng, nâng cao trải nghiệm và tạo ra các giải pháp tài chính có giá trị lâu dài.",
        en: "Understanding customer needs, improving experiences, and delivering financial solutions with long-term value.",
        kr: "고객의 요구를 이해하고 경험을 향상시키며 장기적인 가치를 제공하는 금융 솔루션을 제공합니다.",
      },
    },
  ];
  return `
    <section class="landing-section core-section">
      <div class="container">
        <div class="landing-section-head reveal">
          <span class="section-kicker">KIS DNA</span>
          <h2>${translate("coreTitle")}</h2>
          <p>${translate("coreSubtitle")}</p>
        </div>
        <div class="core-grid">
          ${values.map(CoreValueCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function CCHNNameCard(name, index) {
  const initials = name.split(" ").slice(-2).map((part) => part[0]).join("");
  return `
    <article class="cchn-name-card reveal" data-name="${name.toLowerCase()}">
      <span class="cchn-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="cchn-avatar">${initials}</span>
      <strong>${name}</strong>
      ${icon("certificate")}
    </article>
  `;
}

function CCHNNameList() {
  const sorted = [...cchnNames].sort((a, b) => a.localeCompare(b, "vi"));
  return `
    <section class="landing-section ice">
      <div class="container">
        <div class="landing-section-head reveal">
          <span class="section-kicker">Professional Certificates</span>
          <h2>${translate("cchnTitle")}</h2>
          <p>${translate("cchnSubtitle")}</p>
        </div>
        <div class="cchn-tools reveal">
          <input id="cchnSearch" type="search" placeholder="${translate("searchName")}" />
          <button class="btn btn-outline" id="sortCchn">${translate("sortAZ")}</button>
        </div>
        <div class="cchn-grid" id="cchnGrid">
          ${sorted.map(CCHNNameCard).join("")}
        </div>
        <div class="pagination reveal"><button class="active">1</button><button>2</button><button>3</button></div>
      </div>
    </section>
  `;
}

function AboutKisPage() {
  return `
    <div class="page about-page">
      ${Header()}
      <section class="about-hero">
        <div class="container about-hero-inner reveal">
          <span class="section-kicker">About KIS Vietnam</span>
          <h1>KIS Việt Nam</h1>
          <p>${translate("philosophySubtitle")}</p>
        </div>
      </section>
      <section class="landing-section">
        <div class="container purpose-layout reveal">
          <div>
            <span class="section-kicker">Philosophy</span>
            <h2>${translate("philosophyTitle")}</h2>
          </div>
          <p>${translate("philosophySubtitle")}</p>
        </div>
      </section>
      ${CoreValuesMissionSection()}
      ${CCHNNameList()}
      ${Footer()}
    </div>
  `;
}

function LoginPage() {
  return `
    <main class="auth-page">
      <section class="auth-panel">
        ${brand()}
        <div class="auth-copy">
          <h1>${translate("loginSystem")}</h1>
          <p>${translate("heroSubtitle")}</p>
        </div>
      </section>
      <section class="auth-visual">
        <form class="card login-card">
          <span class="brand"><span class="brand-mark">KIS</span><span>KIS Training Center</span></span>
          <h2>MyKIS Learning</h2>
          <p>Tài khoản được cấp bởi Phòng Nhân sự.</p>
          <div class="field"><label>Email / Mã nhân viên</label><input value="an.nguyen@kisvn.vn" /></div>
          <div class="field"><label>Mật khẩu</label><input type="password" value="training2026" /></div>
          <button class="btn btn-primary" type="submit" style="width:100%">${translate("loginSystem")}</button>
          <button class="btn btn-outline" type="button" data-route="home" style="width:100%; margin-top:10px">Về trang chủ</button>
        </form>
      </section>
    </main>
  `;
}

function animateCountUps() {
  document.querySelectorAll("[data-countup]").forEach((el) => {
    const target = Number(el.dataset.countup || 0);
    const suffix = el.dataset.suffix || "";
    const duration = 850;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = `${value.toLocaleString("vi-VN")}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function observeReveals() {
  const reveals = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach((item) => observer.observe(item));
}

function navigate(route) {
  if (route === "home") history.pushState({}, "", "/");
  if (route === "about") history.pushState({}, "", "/about-kis");
  if (route === "login") history.pushState({}, "", "/#login");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindEvents() {
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });
  document.querySelectorAll("[data-route]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(el.dataset.route);
    });
  });
  document.querySelectorAll("[data-scroll-target]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById(el.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelector(".login-card")?.addEventListener("submit", (event) => {
    event.preventDefault();
    history.pushState({}, "", "/#employee");
    render();
  });
  const cchnSearch = document.getElementById("cchnSearch");
  cchnSearch?.addEventListener("input", () => {
    const term = cchnSearch.value.trim().toLowerCase();
    document.querySelectorAll(".cchn-name-card").forEach((card) => {
      card.style.display = card.dataset.name.includes(term) ? "" : "none";
    });
  });
}

function render() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const hash = window.location.hash.replace("#", "");
  if (path === "/about-kis") app.innerHTML = AboutKisPage();
  else if (hash === "login") app.innerHTML = LoginPage();
  else app.innerHTML = LandingPage();
  bindEvents();
  observeReveals();
  animateCountUps();
}

window.addEventListener("popstate", render);
render();
