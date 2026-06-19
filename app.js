import { dictionaries, getInitialLanguage, saveLanguage } from "./lib/i18n/index.js";
import {
  addSecurityAuditLog,
  changePassword,
  clearSession,
  createAccount,
  disableAccount,
  findAccount,
  forcePasswordChange,
  generateTemporaryPassword,
  getAccountById,
  getAccounts,
  getSecurityAuditLog,
  getSession,
  initMockDatabase,
  login,
  DEMO_HR_EMAIL,
  DEMO_HR_PASSWORD,
  resendActivationEmail,
  resetDemoHrAccount,
  resetPassword,
  unlockAccount,
} from "./lib/mockDatabase.js";
import { validatePassword } from "./lib/auth/passwordPolicy.js";

const app = document.getElementById("app");

let language = getInitialLanguage();
let route = location.pathname;
let session = getSession();
let selectedLoginRole = new URLSearchParams(location.search).get("role") || "employee";
let previewTab = "employee";
let accountSearch = "";
let accountFilters = { department: "", role: "", accountStatus: "", passwordStatus: "" };
let selectedAccountId = "";
let accountDrawerOpen = false;
let resetModalOpen = false;
let resetTargetId = "";
let temporaryPasswordResult = "";
let cchnSearch = "";
let cchnFilters = { department: "", certificate: "", year: "", status: "" };
let activeTimelineYear = "2015";

initMockDatabase();

const hrContact = "Nguyễn Thị Cẩm Thanh";

const courses = [
  ["building", "Tổng quan KIS", "Tìm hiểu lịch sử hình thành, năng lực tài chính, mạng lưới toàn cầu và định hướng phát triển của KIS Việt Nam.", 4, ["Về KIS", "Onboarding"]],
  ["file", "Chính sách nhân sự", "Nắm các quy định nội bộ, quy trình làm việc, chính sách phúc lợi và hướng dẫn dành cho nhân viên.", 6, ["HR", "Quy định"]],
  ["chart", "Kiến thức chứng khoán cơ bản", "Củng cố kiến thức nền tảng về thị trường chứng khoán, sản phẩm dịch vụ và vận hành trong ngành.", 8, ["Nghiệp vụ", "Nền tảng"]],
  ["award", "Chứng chỉ hành nghề Môi giới chứng khoán", "Lộ trình ôn tập, tài liệu chuyên đề, bộ câu hỏi luyện tập và nội dung trọng tâm hỗ trợ nhân viên chuẩn bị cho kỳ thi chứng chỉ hành nghề.", 5, ["Tài liệu ôn tập trọng tâm", "Bộ đề luyện tập", "Theo dõi tiến độ ôn thi", "Chuẩn bị cho kỳ thi UBCKNN"]],
  ["message", "Kỹ năng mềm", "Phát triển các kỹ năng thực chiến như giao tiếp, phối hợp nội bộ, phản hồi, trình bày và chăm sóc khách hàng.", 7, ["Communication", "FAB"]],
  ["grid", "Báo cáo & trình bày công việc", "Chuẩn hóa kỹ năng báo cáo, sắp xếp vấn đề, trình bày mạch lạc và phối hợp với cấp quản lý.", 6, ["Báo cáo", "Quản trị"]],
];

const courseProgress = [
  ["Communication Training", "inProgress", 72],
  ["Chứng chỉ hành nghề Môi giới chứng khoán", "inProgress", 70],
  ["Tổng quan KIS Việt Nam", "completed", 100],
];

const employees = [
  ["Nguyễn Văn An", "Môi giới", "inProgress", 68, "Chứng chỉ hành nghề Môi giới chứng khoán"],
  ["Trần Minh Anh", "Phân tích", "completed", 100, "Kiến thức chứng khoán cơ bản"],
  ["Lê Hoàng Nam", "Vận hành", "notStarted", 0, "Tổng quan KIS Việt Nam"],
  ["Phạm Thu Hà", "HR", "inProgress", 45, "Quy trình báo cáo và trình bày vấn đề"],
  ["Đỗ Gia Huy", "IT", "overdue", 30, "Communication Training"],
];

const cchnMock = [
  { fullName: "Nguyễn Văn An", employeeCode: "KIS-2026-001", department: "Môi giới", position: "Chuyên viên Môi giới", certificateType: "Chứng chỉ Môi giới chứng khoán", certificateNo: "CCHN-001", issueDate: "2025-05-18", year: "2025", status: "Còn hiệu lực" },
  { fullName: "Trần Minh Anh", employeeCode: "KIS-2026-002", department: "Phân tích", position: "Chuyên viên Phân tích", certificateType: "Chứng chỉ Phân tích tài chính", certificateNo: "CCHN-002", issueDate: "2024-11-20", year: "2024", status: "Còn hiệu lực" },
  { fullName: "Lê Hoàng Nam", employeeCode: "KIS-2026-003", department: "Vận hành", position: "Chuyên viên Vận hành", certificateType: "Chứng chỉ Môi giới chứng khoán", certificateNo: "CCHN-003", issueDate: "2026-03-04", year: "2026", status: "Còn hiệu lực" },
  { fullName: "Phạm Thu Hà", employeeCode: "KIS-2026-004", department: "HR", position: "Chuyên viên HR", certificateType: "Chứng chỉ chuyên môn chứng khoán", certificateNo: "CCHN-004", issueDate: "2025-08-09", year: "2025", status: "Cần cập nhật" },
  { fullName: "Nguyễn Thị Cẩm Thanh", employeeCode: "KIS-2026-005", department: "HR", position: "Assistant Manager Training & Development", certificateType: "Chứng chỉ chuyên môn chứng khoán", certificateNo: "CCHN-005", issueDate: "2025-09-28", year: "2025", status: "Còn hiệu lực" },
];

const timelineData = {
  2015: { image: "/assets/timeline/2015.jpeg", events: ["01/06/2015: Thành lập Phòng giao dịch Bà Triệu, Hà Nội.", "08/07/2015: Thành lập Phòng giao dịch Nguyễn Tri Phương, TP. Hồ Chí Minh.", "09/01/2015: KIS Việt Nam tăng vốn điều lệ từ 264 tỷ đồng lên 1.113 tỷ đồng."] },
  2016: { image: "/assets/timeline/2016.jpeg", events: ["06/07/2016: Thành lập Phòng giao dịch Láng Hạ, Hà Nội.", "06/09/2016: Thành lập Phòng giao dịch Phạm Ngọc Thạch, TP. Hồ Chí Minh.", "2016: KIS được vinh danh Top 10 công ty chứng khoán dẫn đầu về thị phần môi giới tại HOSE và HNX."] },
  2018: { image: "/assets/timeline/2018.png", events: ["11/06/2018: KIS trở thành thành viên giao dịch thị trường chứng khoán phái sinh.", "14/05/2018: KIS tăng vốn điều lệ từ 1.113 tỷ đồng thành 1.897 tỷ đồng."] },
  2019: { image: "/assets/timeline/2019.jpeg", events: ["07/06/2019: KIS là 1 trong 7 công ty chứng khoán đầu tiên nhận Chứng nhận phát hành chứng quyền.", "03/09/2019: Đổi tên và chuyển trụ sở chi nhánh Nguyễn Tri Phương thành chi nhánh Sài Gòn tại Tòa nhà TNR."] },
  2020: { image: "/assets/timeline/2020.png", events: ["30/06/2020: KIS tăng vốn điều lệ lên 2.596 tỷ VND, nâng tỷ lệ sở hữu của KIS Hàn Quốc lên 99.7%.", "TOP 9 thị phần môi giới năm 2020 sàn HOSE."] },
  2021: { image: "/assets/timeline/2021.png", events: ["30/06/2021: KIS tăng vốn điều lệ lên 3.761 tỷ VND, nâng tỷ lệ sở hữu của KIS Hàn Quốc lên 99.8%.", "TOP 10 thị phần quý 2 năm 2021 sàn HOSE."] },
  2025: { image: "/assets/timeline/2025.jpeg", events: ["Tăng vốn điều lệ lên 4.550 tỷ đồng.", "TOP 9 thị phần môi giới HOSE năm 2025."] },
};

function d() {
  return dictionaries[language] || dictionaries.vi;
}

function t(path) {
  return path.split(".").reduce((obj, key) => obj?.[key], d()) ?? path;
}

function navigate(path) {
  history.pushState({}, "", path);
  route = location.pathname;
  session = getSession();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToId(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  else {
    navigate("/");
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function icon(name) {
  const icons = {
    building: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M8 7h2M8 11h2M8 15h2M14 7h.01M14 11h.01M14 15h.01M3 21h18"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/></svg>',
    award: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/></svg>',
    message: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
  };
  return `<span class="icon">${icons[name] || icons.file}</span>`;
}

function brand() {
  return `<a class="brand" href="/" data-link><img class="brand-logo" src="/assets/kis-logo-horizontal.png" alt="KIS"><span>${t("brand")}</span></a>`;
}

function languageSwitcher() {
  return `<div class="language-switch">${["vi", "en", "kr"].map((lang) => `<button type="button" class="${language === lang ? "active" : ""}" data-language="${lang}">${dictionaries[lang].lang}</button>`).join("")}</div>`;
}

function header() {
  return `
    <header class="header">
      <div class="container header-inner">
        ${brand()}
        <nav class="nav">
          <a href="/" data-link>${t("nav.home")}</a>
          <a href="/about-kis" data-link>${t("nav.about")}</a>
          <button class="nav-button" data-scroll="courses">${t("nav.courses")}</button>
          <button class="nav-button" data-dashboard-link>${t("nav.dashboard")}</button>
          <button class="nav-button" data-scroll="support">${t("nav.support")}</button>
        </nav>
        <div class="header-actions">
          ${languageSwitcher()}
          <a class="btn btn-outline" href="/login" data-link>${t("nav.login")}</a>
          <button class="btn btn-primary" data-hr-link>${t("nav.hr")}</button>
        </div>
      </div>
    </header>
  `;
}

function footer() {
  return `
    <footer class="footer">
      <div class="container footer-inner">
        <div><strong>${t("brand")}</strong><p>${t("landing.footer")}</p><p>${t("landing.eyebrow")}</p><p>${t("nav.support")}: ${hrContact}</p></div>
        <div class="footer-links">
          <a href="/about-kis" data-link>${t("nav.about")}</a>
          <a href="#">${language === "kr" ? "내부 정책" : language === "en" ? "Internal Policy" : "Chính sách nội bộ"}</a>
          <button class="footer-link-button" data-scroll="support">${t("nav.support")}</button>
          <button class="footer-link-button" data-scroll="support">${language === "kr" ? "HR 문의" : language === "en" ? "Contact HR" : "Liên hệ HR"}</button>
        </div>
      </div>
    </footer>
  `;
}

function badge(key) {
  const cls = { active: "done", completed: "done", inProgress: "learning", notStarted: "new", pendingActivation: "pending", temporarilyLocked: "late", overdue: "late", disabled: "new" }[key] || "new";
  return `<span class="badge ${cls}">${t(`status.${key}`)}</span>`;
}

function progress(value) {
  return `<div class="progress"><span style="--value:${value}%"></span></div>`;
}

function landingPage() {
  const purposes = [
    ["building", "purpose.onboarding", "Giúp nhân viên mới nắm rõ lịch sử công ty, văn hóa doanh nghiệp, quy trình nội bộ và các chính sách nhân sự bắt buộc."],
    ["message", "purpose.softSkills", "Cung cấp các khóa học thực chiến về kỹ năng giao tiếp, kỹ năng bán hàng (FAB) và quy trình phối hợp liên phòng ban."],
    ["award", "purpose.certificate", "Hệ thống hóa tài liệu, lộ trình học và ôn tập chuyên sâu để chuẩn bị cho các kỳ thi chứng chỉ chuyên môn của UBCKNN."],
    ["check", "purpose.testing", "Tổ chức các bài test định kỳ, sát hạch năng lực và tự động ghi nhận tiến độ, cấp chứng nhận hoàn thành."],
  ];
  return `
    <div class="page">
      ${header()}
      <section class="hero">
        <div class="container hero-grid">
          <div>
            <span class="eyebrow">${t("landing.eyebrow")}</span>
            <h1>${t("landing.title")}</h1>
            <h2>${t("landing.subtitle")}</h2>
            <p>${t("landing.desc")}</p>
            <div class="hero-actions"><a class="btn btn-primary" href="/login" data-link>${t("landing.cta")}</a><button class="btn btn-outline" data-scroll="dashboard">${t("landing.cta2")}</button></div>
            <div class="hero-proof"><div class="proof-item"><strong>3</strong><span>Role</span></div><div class="proof-item"><strong>8</strong><span>Module</span></div><div class="proof-item"><strong>68%</strong><span>Progress</span></div></div>
          </div>
          ${heroMockup()}
        </div>
      </section>
      <section class="section" id="purpose"><div class="container"><h2 class="section-title">${t("landing.purpose")}</h2><p class="section-lead">${t("landing.purposeLead")}</p><div class="grid-4 purpose-grid">${purposes.map(([i, key, desc]) => `<article class="card info-card purpose-card">${icon(i)}<h3>${t(key)}</h3><p>${desc}</p></article>`).join("")}</div></div></section>
      <section class="section" id="courses"><div class="container"><h2 class="section-title">${t("landing.categories")}</h2><div class="grid-6">${courses.map((c) => `<article class="card info-card course-category ${c[1].includes("Chứng chỉ") ? "featured-course" : ""}">${icon(c[0])}<h3>${c[1]}</h3><p>${c[2]}</p><div class="tag-row">${c[4].map((tag) => `<span>${tag}</span>`).join("")}</div><span class="card-meta">${c[3]} ${t("nav.courses").toLowerCase()}</span></article>`).join("")}</div></div></section>
      <section class="section" id="dashboard"><div class="container"><div class="section-head"><div><h2 class="section-title">${t("landing.preview")}</h2><p class="section-lead">Employee / HR control view</p></div><div class="preview-tabs"><button class="tab ${previewTab === "employee" ? "active" : ""}" data-preview="employee">${t("roles.employee")}</button><button class="tab ${previewTab === "hr" ? "active" : ""}" data-preview="hr">HR</button></div></div>${previewTab === "employee" ? employeeDashboard(true) : adminDashboard(true)}</div></section>
      <section class="section alt" id="support"><div class="container"><div class="support-panel card"><div><h2>${t("nav.support")}</h2><p>Liên hệ hỗ trợ đào tạo, tài khoản và phân quyền nội bộ.</p></div><strong>${hrContact}</strong></div></div></section>
      ${footer()}
    </div>
  `;
}

function heroMockup() {
  return `
    <div class="mock-shell"><div class="mock-window"><div class="mock-topbar"><div class="dots"><i></i><i></i><i></i></div><span class="badge learning">Onboarding Control</span></div><div class="mock-body"><aside class="mock-side"><span></span><span></span><span></span><span></span></aside><main class="mock-main">
      <div class="metric-row"><div class="mini-card"><span class="mini-label">Progress</span><strong class="mini-value">68%</strong>${progress(68)}</div><div class="mini-card"><span class="mini-label">Certificates</span><strong class="mini-value">02</strong>${badge("completed")}</div></div>
      ${courseProgress.map(([title, status, value]) => `<div class="course-line"><div><strong>${title}</strong><small>${value}%</small>${progress(value)}</div>${badge(status)}</div>`).join("")}
      <div class="course-line"><div><strong>Bài kiểm tra sắp đến hạn</strong><small>Kiến thức chứng khoán - 29/06/2026</small></div>${badge("overdue")}</div>
      <div class="mini-card contact-card"><span class="mini-label">Người phụ trách đào tạo</span><strong>${hrContact}</strong><small>HR/L&D - KIS Việt Nam</small></div>
    </main></div></div></div>
  `;
}

function aboutPage() {
  return `
    <div class="page about-page">
      ${header()}
      <section class="about-premium-hero about-image-hero">
        <div class="container about-premium-grid">
          <div><span class="breadcrumb">${t("about.breadcrumb")}</span><span class="eyebrow">${t("about.eyebrow")}</span><h1>${t("about.title")}</h1><p>Hành trình phát triển, nền tảng tài chính, mạng lưới toàn cầu và sức mạnh con người tạo nên KIS Việt Nam.</p><div class="hero-actions"><button class="btn btn-primary" data-scroll="kis-overview">${t("about.financialCta")}</button><button class="btn btn-outline light" data-scroll="kis-history">${t("about.honorCta")}</button></div></div>
          <div class="profile-summary-card">${[["12/2010", "Thành lập"], ["4.550 tỷ VND", "Vốn điều lệ"], ["99.8%", "Sở hữu KIS Korea"], ["15+ năm", "Hoạt động tại Việt Nam"]].map(([v, l]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("")}</div>
        </div>
      </section>
      <main>
        ${kisOverviewSection()}
        ${globalNetworkSection()}
        ${kisTimelineSection()}
        ${ceoMessageSection()}
        ${corporatePhilosophySection()}
        ${cchnHonorSection()}
      </main>
      ${footer()}
    </div>
  `;
}

function kisOverviewSection() {
  const stats = [["12/2010", "Thành lập"], ["99.8%", "Sở hữu KIS Korea"], ["4.550 tỷ VND", "Vốn điều lệ"], ["15+ năm", "Hoạt động tại Việt Nam"]];
  return `<section class="section" id="kis-overview"><div class="container overview-split"><div><span class="eyebrow">Overview</span><h2 class="section-title">Tổng quan KIS Việt Nam</h2><div class="overview-copy"><p>Công ty Cổ phần Chứng khoán KIS Vietnam (KIS Vietnam) được thành lập vào tháng 12 năm 2010 bởi Công ty Cổ phần Đầu tư & Chứng khoán Hàn Quốc (KIS Korea), cùng với sự đầu tư của Tập đoàn Dệt may Việt Nam và các cổ đông khác. KIS Korea nắm giữ 48,8% cổ phần tại KIS Vietnam tính đến tháng 11 năm 2010 và đã dần dần tăng cường sở hữu trong những năm qua, với tỷ lệ sở hữu chính thức hiện tại là <strong>99,8%</strong>.</p><p>Trong suốt <strong>15 năm</strong> hoạt động tại thị trường Việt Nam, KIS Vietnam đã liên tục tăng vốn để mở rộng các hoạt động kinh doanh của công ty, với tổng vốn điều lệ đạt <strong>4.550 tỷ VND</strong>, và con số này sẽ tiếp tục tăng trong tương lai.</p><p>KIS Vietnam nhận được sự hỗ trợ mạnh mẽ từ Tập đoàn KIS tại Hàn Quốc, tận dụng kinh nghiệm trong lĩnh vực tài chính và sự hợp tác của các chuyên gia nước ngoài cùng đội ngũ nhân viên xuất sắc có nhiều năm kinh nghiệm trong ngân hàng, kiểm toán và thị trường vốn trong nước.</p><p>KIS Vietnam tập trung phát triển kỹ thuật quản lý hoạt động và quản lý rủi ro để định vị công ty như một nhà lãnh đạo trong các lĩnh vực tài chính tại Việt Nam. Chúng tôi tin rằng nguồn nhân lực là yếu tố then chốt xây dựng danh tiếng và thành công của KIS Vietnam trên thị trường chứng khoán.</p></div></div><aside class="overview-stat-card card">${stats.map(([v,l]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("")}</aside></div></section>`;
}

function globalNetworkSection() {
  const cards = [
    ["Korea Investment & Securities (KIS)", "8 công ty con", "1 văn phòng đại diện"],
    ["Korea Investment Management (KIM)", "1 công ty con", "1 văn phòng đại diện"],
    ["Korea Investment Partners (KIP)", "1 công ty con", "2 văn phòng đại diện"],
    ["KIARA Advisors", "Global advisory network", ""],
  ];
  return `<section class="section alt global-network-section"><div class="container"><div class="section-head"><div><span class="eyebrow">Global Network</span><h2 class="section-title">${t("about.network")}</h2><p class="section-lead">KIS kết nối năng lực tài chính, đầu tư và quản trị quốc tế nhằm hỗ trợ sự phát triển bền vững tại thị trường Việt Nam.</p></div></div><div class="network-summary-grid">${cards.map(([title, left, right]) => `<article class="card network-summary-card"><h3>${title}</h3><p>${right ? `${left} <span>|</span> ${right}` : left}</p></article>`).join("")}</div><div class="network-reference-map"><img src="/assets/about/global-network.png" alt="Mạng lưới KIS toàn cầu với bản đồ dotted map và các văn phòng quốc tế"></div></div></section>`;
}

function kisTimelineSection() {
  const item = timelineData[activeTimelineYear];
  return `<section class="section" id="kis-history"><div class="container"><h2 class="section-title">Lịch sử phát triển</h2><div class="year-nav">${Object.keys(timelineData).map((year) => `<button class="${activeTimelineYear === year ? "active" : ""}" data-timeline-year="${year}">${year}</button>`).join("")}</div><div class="timeline-detail"><div class="timeline-image-wrap"><img src="${item.image}" alt="Sự kiện KIS năm ${activeTimelineYear}"></div><div class="timeline-content"><span>${activeTimelineYear}</span><h3>KIS Vietnam Milestone</h3><ul>${item.events.map((event) => `<li>${event}</li>`).join("")}</ul></div></div></div></section>`;
}

function ceoMessageSection() {
  const paragraphs = ["Kính gửi Quý Nhà đầu tư và Đối tác,", "Thay mặt Công ty Cổ phần Chứng khoán KIS Việt Nam, tôi xin gửi lời cảm ơn chân thành tới Quý Nhà đầu tư và Đối tác đã luôn tin tưởng, đồng hành và ủng hộ KIS Việt Nam trong suốt chặng đường phát triển hơn 15 năm qua.", "Ngay từ những ngày đầu thành lập, KIS Việt Nam luôn kiên định với định hướng lấy khách hàng làm trung tâm, không ngừng nâng cao chất lượng dịch vụ và ứng dụng công nghệ hiện đại nhằm mang đến các sản phẩm, giải pháp tài chính toàn diện cho nhà đầu tư cá nhân, tổ chức trong nước và quốc tế. Chúng tôi tin rằng sự thành công của khách hàng chính là nền tảng cho sự phát triển bền vững của KIS Việt Nam.", "Với mục tiêu trở thành một trong những định chế tài chính hàng đầu trên thị trường vốn Việt Nam, KIS Việt Nam không chỉ kế thừa nền tảng tài chính vững mạnh, kinh nghiệm quản trị và mạng lưới toàn cầu từ KIS Hàn Quốc, mà còn không ngừng đầu tư vào nguồn nhân lực chất lượng cao, công nghệ và hạ tầng giao dịch hiện đại để nâng cao trải nghiệm khách hàng.", "Sở hữu đội ngũ chuyên gia giàu kinh nghiệm cùng sự hỗ trợ từ các giải pháp công nghệ tiên tiến, chúng tôi cam kết tiếp tục đồng hành cùng Quý khách hàng và đối tác trên hành trình đầu tư, mang đến những giá trị thiết thực, bền vững và hiệu quả.", "Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý vị. Kính chúc Quý Nhà đầu tư, Đối tác cùng gia đình sức khỏe, hạnh phúc và thành công.", "Trân trọng."];
  return `<section class="section alt"><div class="container"><h2 class="section-title">Lời Tổng Giám đốc</h2><div class="ceo-message-card card"><div class="ceo-photo"><img src="/assets/about/tgd.jpeg" alt="Shin, Hyun Jae - Tổng Giám đốc"></div><div class="ceo-copy"><span class="eyebrow">${t("about.leadership")}</span><h3>Shin, Hyun Jae</h3><p class="label">Tổng Giám đốc</p><div class="ceo-letter">${paragraphs.map((p) => `<p>${p}</p>`).join("")}</div></div></div></div></section>`;
}

function corporatePhilosophySection() {
  const cards = [["01", "Làm hài lòng khách hàng", ["Khách hàng là lý do mà công ty chứng khoán tồn tại.", "Ra quyết định dựa trên góc nhìn của khách hàng.", "Phát triển cùng với khách hàng bằng cách đảm bảo sự hài lòng của họ."]], ["02", "Kiến tạo giá trị mới", ["Liên tục tạo ra giá trị mới cho xã hội.", "Đổi mới với tinh thần thử thách bằng cách nâng cao năng lực tổ chức.", "Theo đuổi những mục tiêu cao nhất và sự xuất sắc."]], ["03", "Tôn trọng cá nhân", ["Chúng tôi luôn tôn trọng từng cá nhân trong đội ngũ của mình.", "Khuyến khích cá nhân phát triển khả năng của họ tại nơi làm việc.", "Hỗ trợ mỗi cá nhân trở thành những nhân viên xuất sắc."]]];
  return `<section class="section"><div class="container"><h2 class="section-title">Triết lý tập đoàn</h2><div class="grid-3">${cards.map(([no,title,bullets]) => `<article class="card philosophy-premium philosophy-list-card">${icon("check")}<span>${no}</span><h3>${title}</h3><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul></article>`).join("")}</div></div></section>`;
}

function cchnRows() {
  return cchnMock;
}

function filteredCchnRows() {
  return cchnRows().filter((row) => {
    const text = `${row.fullName} ${row.employeeCode}`.toLowerCase();
    return (!cchnSearch || text.includes(cchnSearch.toLowerCase()))
      && (!cchnFilters.department || row.department === cchnFilters.department)
      && (!cchnFilters.certificate || row.certificateType === cchnFilters.certificate)
      && (!cchnFilters.year || row.year === cchnFilters.year)
      && (!cchnFilters.status || row.status === cchnFilters.status);
  });
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))];
}

function cchnHonorSection() {
  const rows = filteredCchnRows();
  const allRows = cchnRows();
  const topDept = mostCommon(allRows.map((row) => row.department));
  const topYear = mostCommon(allRows.map((row) => row.year));
  return `
    <section class="section cchn-section" id="cchn-honor">
      <div class="container">
        <div class="cchn-table-shell card">
          <div class="section-head"><div><span class="eyebrow">CCHN</span><h2 class="section-title">${t("about.honorTitle")}</h2><p class="section-lead">${t("about.honorSubtitle")}</p></div></div>
          <div class="cchn-stats table-stats">${[[t("about.totalPeople"), allRows.length], [t("about.totalCerts"), allRows.length], ["Phòng ban có nhiều CCHN nhất", topDept || "--"], ["Năm cấp gần nhất", topYear || "--"]].map(([l, v]) => `<div class="stat-card compact-stat"><span>${l}</span><strong>${v}</strong></div>`).join("")}</div>
        <div class="cchn-filter table-only-filter">
          <input data-cchn-search placeholder="${language === "kr" ? "이름/사번 검색" : language === "en" ? "Search name/employee ID" : "Tìm họ tên/mã nhân viên"}" value="${cchnSearch}">
          ${selectFilter("department", t("table.department"), uniqueValues(allRows, "department"), cchnFilters.department)}
          ${selectFilter("certificate", t("table.certificate"), uniqueValues(allRows, "certificateType"), cchnFilters.certificate)}
          ${selectFilter("year", t("table.year"), uniqueValues(allRows, "year"), cchnFilters.year)}
        </div>
        ${rows.length ? cchnTableView(rows) : emptyCchnState()}
        </div>
      </div>
    </section>
  `;
}

function selectFilter(name, label, values, selected) {
  return `<select data-cchn-filter="${name}"><option value="">${label}</option>${values.map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`).join("")}</select>`;
}

function cchnTableView(rows) {
  return `<div class="table-wrap cchn-table polished-table"><table><thead><tr><th>STT</th>${["fullName", "code", "department", "position", "certificate", "certNo", "issueDate", "year", "status"].map((k) => `<th>${t(`table.${k}`)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, index) => `<tr><td>${index + 1}</td><td><strong>${r.fullName}</strong></td><td>${r.employeeCode || ""}</td><td>${r.department || ""}</td><td>${r.position || ""}</td><td>${r.certificateType || ""}</td><td>${r.certificateNo || ""}</td><td>${r.issueDate || ""}</td><td>${r.year || ""}</td><td>${cchnStatusBadge(r.status)}</td></tr>`).join("")}</tbody></table></div>`;
}

function cchnStatusBadge(status = "Còn hiệu lực") {
  const cls = status.includes("Cần") ? "pending" : status.includes("Hết") ? "late" : "done";
  return `<span class="badge ${cls}">${status}</span>`;
}

function emptyCchnState() {
  return `<div class="empty-cchn">${icon("award")}<h3>${t("about.noData")}</h3><p>${t("about.noDataDesc")}</p></div>`;
}

function loginPage() {
  return `
    <main class="auth-page">
      <section class="auth-panel">${brand()}<div class="auth-copy"><h1>${t("login.title")}</h1><p>${t("login.subtitle")}</p></div></section>
      <section class="auth-visual">
        <form class="card login-card" id="loginForm">
          <div class="login-card-head">${brand()}${languageSwitcher()}</div>
          <h2>${t("login.title")}</h2><p>${t("login.note")}</p>
          <div class="role-toggle">${["employee", "hr", "manager"].map((role) => `<button type="button" class="${selectedLoginRole === role ? "active" : ""}" data-login-role="${role}">${t(`roles.${role}`)}</button>`).join("")}</div>
          <div class="field"><label>${t("login.email")}</label><input name="identifier" autocomplete="username" type="email"></div>
          <div class="field"><label>${t("login.password")}</label><input name="password" type="password" autocomplete="current-password"></div>
          <div class="login-tools"><span>${t("login.note")}</span><button class="link-button" type="button">${t("login.forgot")}</button></div>
          <button class="btn btn-primary" type="submit" style="width:100%">${t("login.submit")}</button>
          <div class="demo-account-card">
            <div>
              <span class="eyebrow">Tài khoản HR demo</span>
              <h3>Nguyễn Thị Cẩm Thanh</h3>
              <p><strong>Email:</strong> ${DEMO_HR_EMAIL}</p>
              <p><strong>Mật khẩu:</strong> ${DEMO_HR_PASSWORD}</p>
            </div>
            <div class="demo-actions">
              <button class="btn btn-outline" type="button" data-fill-demo-account>Dùng tài khoản này</button>
              <button class="btn btn-ghost" type="button" data-reset-demo-account>Reset demo account</button>
            </div>
          </div>
        </form>
      </section>
    </main>
  `;
}

function employeeDashboard(compact = false) {
  return `
    <div class="${compact ? "dashboard-preview" : "app-layout"}">
      ${compact ? sideNav("employee") : sideNav("employee")}
      <main class="app-main">${topbar("Employee Dashboard", "Xin chào, Nguyễn Văn An", "employee")}<div class="content">
        <div class="kpi-grid"><div class="card kpi"><span class="label">Progress</span><strong>68%</strong>${progress(68)}</div><div class="card kpi"><span class="label">Deadline</span><strong>29/06</strong></div><div class="card kpi"><span class="label">Certificates</span><strong>02</strong></div><div class="card kpi"><span class="label">HR owner</span><strong>${hrContact}</strong></div></div>
        <div class="dashboard-grid"><section class="card panel"><h3>Khóa đang học</h3>${courseProgress.map(([title, status, value]) => `<div class="course-line"><div><strong>${title}</strong><small>${value}%</small>${progress(value)}</div>${badge(status)}</div>`).join("")}</section><aside class="card panel"><h3>Việc cần hoàn thành</h3><div class="task"><strong>Bài test kiến thức chứng khoán trước 29/06/2026</strong><span>${hrContact}</span></div><h3 style="margin-top:22px">Gợi ý khóa học tiếp theo</h3><div class="course-line"><strong>FAB trong trao đổi với khách hàng</strong>${badge("notStarted")}</div></aside></div>
      </div></main>
    </div>
  `;
}

function adminDashboard(compact = false) {
  return `
    <div class="${compact ? "dashboard-preview" : "app-layout"}">${sideNav("hr")}<main class="app-main">${topbar("HR Admin Dashboard", "Quản trị đào tạo nội bộ", "hr")}<div class="content">
      <div class="kpi-grid"><div class="card kpi"><span class="label">Accounts</span><strong>${getAccounts().length}</strong></div><div class="card kpi"><span class="label">New onboarding</span><strong>18</strong></div><div class="card kpi"><span class="label">Overdue</span><strong>05</strong></div><div class="card kpi"><span class="label">Average</span><strong>61%</strong>${progress(61)}</div></div>
      <div class="dashboard-grid"><section class="card panel"><h3>Completion rate</h3><div class="chart-row"><div class="donut"></div><div class="bar-chart"><span class="bar" style="--h:68%"></span><span class="bar" style="--h:100%"></span><span class="bar" style="--h:45%"></span><span class="bar" style="--h:30%"></span></div></div></section><section class="card panel"><h3>${t("admin.overview")}</h3><p class="label">HR: ${hrContact}</p><div class="table-actions"><a class="btn btn-primary" href="/admin/accounts" data-link>${t("admin.accounts")}</a><a class="btn btn-outline" href="/admin/reports" data-link>${t("admin.reports")}</a></div></section></div>
    </div></main></div>
  `;
}

function sideNav(role) {
  const items = role === "hr"
    ? [["/admin", "overview"], ["/admin/employees", "employees"], ["/admin/accounts", "accounts"], ["/admin", "courses"], ["/admin", "assign"], ["/admin/reports", "reports"], ["/admin/accounts", "audit"], ["/admin", "permissions"]]
    : [["/dashboard", "overview"], ["/dashboard", "courses"], ["/dashboard", "reports"]];
  return `<aside class="app-sidebar">${brand()}<nav class="side-nav">${items.map(([href, key]) => `<a class="${route === href ? "active" : ""}" href="${href}" data-link>${t(`admin.${key}`) || key}</a>`).join("")}</nav></aside>`;
}

function topbar(label, title, role) {
  return `<div class="topbar"><div><span class="label">${label}</span><h2>${title}</h2></div><div class="topbar-actions">${languageSwitcher()}<div class="user-chip"><span class="avatar">${role === "hr" ? "HR" : "NA"}</span>${session?.fullName || t(`roles.${role}`)}</div></div></div>`;
}

function accountsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const accounts = filteredAccounts();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.accountTitle"), "hr")}<div class="content">
    <section class="card panel account-toolbar"><h3>${t("admin.accountTitle")}</h3><div class="filter-bar account-filter"><input data-account-search placeholder="${t("admin.search")}" value="${accountSearch}">${accountSelect("department", t("table.department"), uniqueValues(getAccounts(), "department"))}${accountSelect("role", t("table.role"), uniqueValues(getAccounts(), "role"))}${accountSelect("accountStatus", t("table.accountStatus"), uniqueValues(getAccounts(), "accountStatus"))}${accountSelect("passwordStatus", t("table.passwordStatus"), ["required", "normal"])}</div></section>
    <section class="card panel">${accountTable(accounts)}</section>
    <section class="card panel"><h3>Security Audit Log</h3>${auditTable()}</section>
  </div></main>${accountDrawer()}${resetPasswordModal()}</div>`;
}

function filteredAccounts() {
  return getAccounts().filter((account) => {
    const text = `${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase();
    const passStatus = account.passwordResetRequired ? "required" : "normal";
    return (!accountSearch || text.includes(accountSearch.toLowerCase()))
      && (!accountFilters.department || account.department === accountFilters.department)
      && (!accountFilters.role || account.role === accountFilters.role)
      && (!accountFilters.accountStatus || account.accountStatus === accountFilters.accountStatus)
      && (!accountFilters.passwordStatus || passStatus === accountFilters.passwordStatus);
  });
}

function accountSelect(name, label, values) {
  return `<select data-account-filter="${name}"><option value="">${label}</option>${values.map((v) => `<option value="${v}" ${accountFilters[name] === v ? "selected" : ""}>${v.startsWith?.("required") || v === "normal" ? t(`status.${v}`) : v}</option>`).join("")}</select>`;
}

function accountTable(accounts) {
  const headers = ["fullName", "code", "email", "department", "role", "accountStatus", "passwordStatus", "failed", "lastLogin", "createdAt", "createdBy", "action"];
  return `<div class="table-wrap account-table"><table><thead><tr>${headers.map((h) => `<th>${h === "action" ? t("admin.action") : t(`table.${h}`)}</th>`).join("")}</tr></thead><tbody>${accounts.map((a) => `<tr><td><button class="row-link" data-account-detail="${a.id}">${a.fullName}</button></td><td>${a.employeeCode}</td><td>${a.email}</td><td>${a.department}</td><td>${a.role}</td><td>${badge(a.accountStatus)}</td><td>${badge(a.passwordResetRequired ? "required" : "normal")}</td><td>${a.failedLoginAttempts}</td><td>${a.lastLoginAt || "-"}</td><td>${a.createdAt}</td><td>${a.createdBy}</td><td><div class="row-actions"><button class="btn btn-outline mini-action" data-account-detail="${a.id}">${t("admin.detail")}</button><button class="btn btn-outline mini-action" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline mini-action" data-force-account="${a.id}">${t("admin.forcePassword")}</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function accountDrawer() {
  if (!accountDrawerOpen || !selectedAccountId) return "";
  const a = getAccountById(selectedAccountId);
  if (!a) return "";
  const logs = getSecurityAuditLog().filter((log) => !log.targetAccountId || log.targetAccountId === a.id || log.targetEmployeeName === a.fullName).slice(0, 5);
  const rows = [["fullName", a.fullName], ["code", a.employeeCode], ["email", a.email], ["role", a.role], ["department", a.department], ["position", a.position], ["accountStatus", badge(a.accountStatus)], ["passwordStatus", badge(a.passwordResetRequired ? "required" : "normal")], ["failed", a.failedLoginAttempts], ["lastLogin", a.lastLoginAt || "-"], ["Last failed login", a.lastFailedLoginAt || "-"], ["Locked until", a.lockedUntil || "-"], ["createdBy", a.createdBy], ["Updated by", a.updatedBy]];
  return `<aside class="account-drawer open"><div class="drawer-head"><div><span class="eyebrow">${t("admin.accounts")}</span><h2>${a.fullName}</h2></div><button class="icon-btn" data-close-drawer>x</button></div><div class="profile-grid">${rows.map(([k, v]) => `<div class="profile-item"><span>${t(`table.${k}`) || k}</span><strong>${v}</strong></div>`).join("")}</div><div class="security-actions"><button class="btn btn-primary" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline" data-force-account="${a.id}">${t("admin.forcePassword")}</button><button class="btn btn-outline" data-unlock-account="${a.id}">${t("admin.unlock")}</button><button class="btn btn-outline" data-disable-account="${a.id}">${t("admin.disable")}</button><button class="btn btn-outline" data-resend-account="${a.id}">${t("admin.resend")}</button></div><h3>Audit log</h3><div class="audit-list">${logs.map((l) => `<div><strong>${l.action}</strong><span>${l.createdAt} · ${l.description}</span></div>`).join("")}</div></aside>`;
}

function resetPasswordModal() {
  if (!resetModalOpen || !resetTargetId) return "";
  const a = getAccountById(resetTargetId);
  if (!a) return "";
  return `<div class="modal-backdrop open"><form class="card modal" id="resetPasswordForm"><div class="modal-head"><div><span class="eyebrow">${t("admin.resetPassword")}</span><h2>${t("modal.resetTitle")}</h2></div><button type="button" class="icon-btn" data-close-reset>x</button></div><div class="profile-grid"><div class="profile-item"><span>${t("table.fullName")}</span><strong>${a.fullName}</strong></div><div class="profile-item"><span>${t("table.code")}</span><strong>${a.employeeCode}</strong></div><div class="profile-item"><span>${t("table.email")}</span><strong>${a.email}</strong></div></div><div class="option-stack"><label><input type="radio" name="mode" value="auto" checked> ${t("modal.auto")}</label><label><input type="radio" name="mode" value="manual"> ${t("modal.manual")}</label><div class="field"><label>${t("admin.tempPassword")}</label><input name="manualPassword" placeholder="KIS@Temp2026"></div><label><input type="checkbox" name="notify" checked> ${t("modal.notify")}</label><label><input type="checkbox" name="require" checked> ${t("modal.require")}</label><label><input type="checkbox" name="unlock" checked> ${t("modal.unlock")}</label><div class="field"><label>${t("modal.note")}</label><textarea name="note" rows="3"></textarea></div></div>${temporaryPasswordResult ? `<div class="temp-password-box"><div><strong>${temporaryPasswordResult}</strong><p>${t("modal.oneTime")}</p></div><button class="btn btn-outline" type="button" data-copy-temp>${t("modal.copy")}</button></div>` : ""}<button class="btn btn-primary" type="submit" style="width:100%">${t("modal.confirm")}</button></form></div>`;
}

function auditTable() {
  return `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead><tbody>${getSecurityAuditLog().slice(0, 8).map((l) => `<tr><td>${l.createdAt}</td><td>${l.actorName}</td><td>${l.action}</td><td>${l.targetEmployeeName}</td><td>${l.result}</td></tr>`).join("")}</tbody></table></div>`;
}

function employeesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.employees"), "hr")}<div class="content"><section class="card panel"><h3>${t("admin.employees")}</h3>${employeeTable()}</section></div></main></div>`;
}

function employeeTable() {
  return `<div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("table.department")}</th><th>${t("table.status")}</th><th>Progress</th><th>Course</th></tr></thead><tbody>${employees.map((e) => `<tr><td><strong>${e[0]}</strong></td><td>${e[1]}</td><td>${badge(e[2])}</td><td>${e[3]}%${progress(e[3])}</td><td>${e[4]}</td></tr>`).join("")}</tbody></table></div>`;
}

function reportsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR/L&D Analytics", t("admin.reports"), "hr")}<div class="content"><div class="kpi-grid"><div class="card kpi"><span class="label">Total</span><strong>128</strong></div><div class="card kpi"><span class="label">Average</span><strong>61%</strong></div><div class="card kpi"><span class="label">Overdue</span><strong>05</strong></div><div class="card kpi"><span class="label">Score</span><strong>84</strong></div></div><section class="card panel"><h3>${t("admin.reports")}</h3><div class="bar-chart"><span class="bar" style="--h:58%"></span><span class="bar" style="--h:63%"></span><span class="bar" style="--h:71%"></span><span class="bar" style="--h:78%"></span></div></section></div></main></div>`;
}

function managerPage() {
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Manager", "Dashboard báo cáo quản lý", "manager")}<div class="content"><div class="kpi-grid"><div class="card kpi"><span class="label">Department employees</span><strong>32</strong></div><div class="card kpi"><span class="label">Average completion</span><strong>74%</strong>${progress(74)}</div><div class="card kpi"><span class="label">Follow-up</span><strong>05</strong></div><div class="card kpi"><span class="label">Overdue</span><strong>03</strong></div></div><section class="card panel"><h3>${t("admin.reports")}</h3>${employeeTable()}</section></div></main></div>`;
}

function changePasswordPage() {
  const account = session?.accountId ? getAccountById(session.accountId) : null;
  return `<main class="auth-page"><section class="auth-panel">${brand()}<div class="auth-copy"><h1>${t("changePassword.title")}</h1><p>${account?.fullName || ""}</p></div></section><section class="auth-visual"><form class="card login-card" id="changePasswordForm"><div class="login-card-head">${brand()}${languageSwitcher()}</div><h2>${t("changePassword.title")}</h2><div class="field"><label>${t("changePassword.current")}</label><input name="current" type="password"></div><div class="field"><label>${t("changePassword.next")}</label><input name="next" type="password"></div><div class="field"><label>${t("changePassword.confirm")}</label><input name="confirm" type="password"></div><div class="policy-card"><strong>Password policy</strong><p>8+ chars, uppercase, lowercase, number, special, not old password.</p></div><button class="btn btn-primary" type="submit" style="width:100%">${t("changePassword.submit")}</button></form></section></main>`;
}

function restrictedPage() {
  return `<div class="page">${header()}<section class="section"><div class="container"><div class="card empty-state">${icon("lock")}<h2>${t("toast.restricted")}</h2><a class="btn btn-primary" href="/login" data-link>${t("nav.login")}</a></div></div></section>${footer()}</div>`;
}

function hasAdminAccess() {
  return ["hr", "superAdmin"].includes(session?.role);
}

function render() {
  route = location.pathname.replace(/\/$/, "") || "/";
  session = getSession();
  selectedLoginRole = new URLSearchParams(location.search).get("role") || selectedLoginRole;
  document.documentElement.lang = language;
  if (route === "/") app.innerHTML = landingPage();
  else if (route === "/about-kis") app.innerHTML = aboutPage();
  else if (route === "/login") app.innerHTML = loginPage();
  else if (route === "/dashboard") app.innerHTML = session ? employeeDashboard(false) : loginPage();
  else if (route === "/admin") app.innerHTML = hasAdminAccess() ? adminDashboard(false) : restrictedPage();
  else if (route === "/admin/employees") app.innerHTML = employeesPage();
  else if (route === "/admin/accounts") app.innerHTML = accountsPage();
  else if (route === "/admin/reports") app.innerHTML = reportsPage();
  else if (route === "/manager") app.innerHTML = session?.role === "manager" ? managerPage() : restrictedPage();
  else if (route === "/change-password") app.innerHTML = changePasswordPage();
  else app.innerHTML = landingPage();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-link]").forEach((el) => el.addEventListener("click", (event) => { event.preventDefault(); navigate(el.getAttribute("href")); }));
  document.querySelectorAll("[data-language]").forEach((el) => el.addEventListener("click", () => { language = el.dataset.language; saveLanguage(language); render(); }));
  document.querySelectorAll("[data-scroll]").forEach((el) => el.addEventListener("click", () => scrollToId(el.dataset.scroll)));
  document.querySelector("[data-dashboard-link]")?.addEventListener("click", () => navigate(session ? (session.role === "hr" || session.role === "superAdmin" ? "/admin" : "/dashboard") : "/login"));
  document.querySelector("[data-hr-link]")?.addEventListener("click", () => navigate(session?.role === "hr" || session?.role === "superAdmin" ? "/admin" : "/login?role=hr"));
  document.querySelectorAll("[data-preview]").forEach((el) => el.addEventListener("click", () => { previewTab = el.dataset.preview; render(); document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }); }));
  document.querySelectorAll("[data-login-role]").forEach((el) => el.addEventListener("click", () => { selectedLoginRole = el.dataset.loginRole; render(); }));
  document.querySelector("[data-fill-demo-account]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    selectedLoginRole = "hr";
    form.elements.identifier.value = DEMO_HR_EMAIL;
    form.elements.password.value = DEMO_HR_PASSWORD;
    document.querySelectorAll("[data-login-role]").forEach((el) => el.classList.toggle("active", el.dataset.loginRole === "hr"));
  });
  document.querySelector("[data-reset-demo-account]")?.addEventListener("click", () => {
    resetDemoHrAccount();
    session = getSession();
    selectedLoginRole = "hr";
    render();
    requestAnimationFrame(() => {
      const form = document.getElementById("loginForm");
      if (!form) return;
      form.elements.identifier.value = DEMO_HR_EMAIL;
      form.elements.password.value = DEMO_HR_PASSWORD;
      toast("success");
    });
  });
  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = login(data.get("identifier"), data.get("password"));
    if (!result.ok) return toast(result.reason === "locked" ? "locked" : "loginFailed");
    session = getSession();
    if (result.reason === "passwordResetRequired") navigate("/change-password");
    else navigate(result.account.role === "hr" || result.account.role === "superAdmin" ? "/admin" : result.account.role === "manager" ? "/manager" : "/dashboard");
  });
  document.getElementById("changePasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = String(data.get("next") || "");
    if (next !== data.get("confirm") || !validatePassword(next, String(data.get("current") || "")).passed) return toast("loginFailed");
    const result = changePassword(session?.accountId, String(data.get("current") || ""), next);
    if (!result.ok) return toast("loginFailed");
    toast("changed");
    navigate(session.role === "hr" || session.role === "superAdmin" ? "/admin" : "/dashboard");
  });
  document.querySelectorAll("[data-account-search]").forEach((el) => el.addEventListener("input", () => { accountSearch = el.value; render(); }));
  document.querySelectorAll("[data-account-filter]").forEach((el) => el.addEventListener("change", () => { accountFilters[el.dataset.accountFilter] = el.value; render(); }));
  document.querySelectorAll("[data-account-detail]").forEach((el) => el.addEventListener("click", () => { selectedAccountId = el.dataset.accountDetail; accountDrawerOpen = true; render(); }));
  document.querySelector("[data-close-drawer]")?.addEventListener("click", () => { accountDrawerOpen = false; render(); });
  document.querySelectorAll("[data-reset-account]").forEach((el) => el.addEventListener("click", () => { resetTargetId = el.dataset.resetAccount; resetModalOpen = true; temporaryPasswordResult = ""; render(); }));
  document.querySelectorAll("[data-force-account]").forEach((el) => el.addEventListener("click", () => { forcePasswordChange(el.dataset.forceAccount); toast("success"); render(); }));
  document.querySelectorAll("[data-unlock-account]").forEach((el) => el.addEventListener("click", () => { if (confirm(t("admin.unlock"))) { unlockAccount(el.dataset.unlockAccount); toast("success"); render(); } }));
  document.querySelectorAll("[data-disable-account]").forEach((el) => el.addEventListener("click", () => { if (confirm(t("admin.disable"))) { disableAccount(el.dataset.disableAccount, "HR action"); toast("success"); render(); } }));
  document.querySelectorAll("[data-resend-account]").forEach((el) => el.addEventListener("click", () => { resendActivationEmail(el.dataset.resendAccount); toast("success"); render(); }));
  document.querySelector("[data-close-reset]")?.addEventListener("click", () => { resetModalOpen = false; temporaryPasswordResult = ""; render(); });
  document.getElementById("resetPasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const temp = data.get("mode") === "manual" && data.get("manualPassword") ? String(data.get("manualPassword")) : generateTemporaryPassword();
    const result = resetPassword(resetTargetId, temp, { requireChange: data.get("require") === "on", unlock: data.get("unlock") === "on" });
    temporaryPasswordResult = result.temporaryPassword;
    toast("passwordReset");
    render();
  });
  document.querySelector("[data-copy-temp]")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(temporaryPasswordResult); toast("copied"); });
  document.querySelectorAll("[data-timeline-year]").forEach((el) => el.addEventListener("click", () => { activeTimelineYear = el.dataset.timelineYear; render(); document.getElementById("kis-history")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  document.querySelector("[data-cchn-search]")?.addEventListener("input", (event) => { cchnSearch = event.target.value; render(); });
  document.querySelectorAll("[data-cchn-filter]").forEach((el) => el.addEventListener("change", () => { cchnFilters[el.dataset.cchnFilter] = el.value; render(); }));
}

function toast(key) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = t(`toast.${key}`) || key;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function mostCommon(values) {
  const counts = values.filter(Boolean).reduce((acc, item) => ((acc[item] = (acc[item] || 0) + 1), acc), {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

window.addEventListener("popstate", render);
render();
