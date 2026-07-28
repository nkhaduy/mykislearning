const app = document.getElementById("app");

const copy = {
  vi: {
    home: "Trang chủ", about: "Về KIS", login: "Đăng nhập", loginSystem: "Đăng nhập hệ thống",
    eyebrow: "Dành riêng cho nhân viên KIS Việt Nam", title: "MyKIS Learning",
    subtitle: "Hệ thống Đào tạo Hội nhập và Phát triển chuyên môn KIS Việt Nam",
    aboutEyebrow: "Về KIS Việt Nam",
    aboutTitle: "Khám phá hành trình và giá trị của KIS Việt Nam",
    aboutDesc: "Hơn 15 năm phát triển, mạng lưới toàn cầu và đội ngũ nhân lực chuyên nghiệp tạo nên KIS Việt Nam.",
    start: "Bắt đầu hành trình học tập",
    startDesc: "Truy cập nền tảng học tập nội bộ được xây dựng riêng cho nhân viên KIS Việt Nam.",
    employees: "Số nhân viên học", openCourses: "Số khóa đào tạo đang mở", hours: "Tổng số giờ học",
    quickLinks: "Liên kết nhanh", support: "Liên hệ hỗ trợ", supportName: "Nguyễn Thị Cẩm Thanh",
    supportRole: "Phòng Nhân sự", supportEmail: "thanh.ntc@kisvn.vn",
    internal: "Chỉ sử dụng nội bộ", footer: "Hệ thống đào tạo hội nhập và phát triển chuyên môn nội bộ",
    employeeOnly: "Dành riêng cho nhân viên KIS Việt Nam", menu: "Mở menu", closeMenu: "Đóng menu",
  },
  en: {
    home: "Home", about: "About KIS", login: "Sign in", loginSystem: "Sign in to the system",
    eyebrow: "Exclusively for KIS Vietnam employees", title: "MyKIS Learning",
    subtitle: "KIS Vietnam Onboarding and Professional Development System",
    aboutEyebrow: "About KIS",
    aboutTitle: "Discover the KIS Vietnam journey",
    aboutDesc: "15+ years of growth, a global network and professional talent powering KIS Vietnam.",
    start: "Start your learning journey",
    startDesc: "Access the internal learning platform built exclusively for KIS Vietnam employees.",
    employees: "Employees learning", openCourses: "Open training courses", hours: "Total learning hours",
    quickLinks: "Quick links", support: "Support", supportName: "Nguyễn Thị Cẩm Thanh",
    supportRole: "Human Resources Department", supportEmail: "thanh.ntc@kisvn.vn",
    internal: "Internal use only", footer: "Internal onboarding and professional development system",
    employeeOnly: "For KIS Vietnam employees only", menu: "Open menu", closeMenu: "Close menu",
  },
  kr: {
    home: "홈", about: "KIS 소개", login: "로그인", loginSystem: "시스템 로그인",
    eyebrow: "KIS Vietnam 임직원 전용", title: "MyKIS Learning",
    subtitle: "KIS Vietnam 온보딩 및 전문 역량 개발 시스템",
    aboutEyebrow: "회사 소개",
    aboutTitle: "KIS Vietnam의 여정을 탐색하세요",
    aboutDesc: "15년 이상의 성장, 글로벌 네트워크와 전문 인재를 바탕으로 한 KIS Vietnam의 이야기입니다.",
    start: "MyKIS Learning과 함께 시작하세요",
    startDesc: "KIS Vietnam 임직원 전용 학습 플랫폼에 접속하세요.",
    employees: "학습 직원 수", openCourses: "공개 교육 과정 수", hours: "총 학습 시간",
    quickLinks: "빠른 링크", support: "지원", supportName: "Nguyễn Thị Cẩm Thanh",
    supportRole: "인사부", supportEmail: "thanh.ntc@kisvn.vn",
    internal: "내부 전용", footer: "사내 온보딩 및 전문 역량 개발 시스템",
    employeeOnly: "KIS Vietnam 임직원 전용", menu: "메뉴 열기", closeMenu: "메뉴 닫기",
  },
};

function currentLanguage() {
  const saved = localStorage.getItem("mykis-language");
  return ["vi", "en", "kr"].includes(saved) ? saved : "vi";
}

function marketingLearningHoursAt(now = Date.now()) {
  const base = 1602;
  const start = Date.parse("2026-07-02T00:00:00+07:00");
  return base + Math.max(0, Math.floor((now - start) / 7_200_000));
}

function languageSwitcher(language) {
  return `<div class="language-switch" data-active-lang="${language}">${["vi", "en", "kr"].map((lang) => `<button type="button" class="${language === lang ? "active" : ""}" data-public-language="${lang}" aria-pressed="${language === lang}">${lang.toUpperCase()}</button>`).join("")}</div>`;
}

let removeMenuKeydown = () => {};
let cleanupMotion = () => {};

function render() {
  cleanupMotion();
  const language = currentLanguage();
  const t = copy[language];
  const learningHoursValue = marketingLearningHoursAt();
  const learningHours = new Intl.NumberFormat(language === "kr" ? "ko-KR" : language === "en" ? "en-US" : "vi-VN").format(learningHoursValue);
  document.documentElement.lang = language === "kr" ? "ko" : language;
  document.body.dataset.route = "/";

  app.innerHTML = `<div class="page landing-page landing-entrance">
    <header class="header"><div class="container header-inner"><a class="brand" href="/"><img class="brand-logo" src="/assets/kis-logo-horizontal.png" alt="KIS" width="700" height="92" decoding="async"><span>MyKIS Learning</span></a><nav class="nav" id="public-nav" aria-label="${t.quickLinks}"><a href="/" aria-current="page" class="is-active">${t.home}</a><a href="/about-kis">${t.about}</a></nav><div class="header-actions">${languageSwitcher(language)}<button class="mobile-nav-toggle" type="button" data-mobile-nav-toggle aria-controls="public-nav" aria-expanded="false" aria-label="${t.menu}"><span aria-hidden="true">☰</span></button><a class="btn btn-primary header-mobile-cta" href="/login" style="font-size:13px;padding:0 14px;min-height:38px">${t.login}</a><a class="btn btn-primary btn--hero header-desktop-login" href="/login">${t.login}</a></div></div></header>
    <section class="hero hero--kis"><div class="hero-banner-wrap"><picture><source media="(max-width:767px)" srcset="/public/images/mykis-learning-banner-mobile.webp" type="image/webp" width="941" height="1672"><source media="(max-width:767px)" srcset="/public/images/mykis-learning-banner-mobile.png" width="941" height="1672"><source srcset="/public/images/mykis-learning-banner-desktop.webp" type="image/webp" width="1672" height="941"><img class="hero-banner-img" src="/public/images/mykis-learning-banner-desktop.png" alt="MyKIS Learning" width="1672" height="941" loading="eager" fetchpriority="high" decoding="sync"></picture></div><div class="container hero-overlay-content"><div class="hero-text"><span class="eyebrow">${t.eyebrow}</span><h1 class="hero-title--kis">${t.title}</h1><p class="hero-subtitle--kis">${t.subtitle}</p><div class="hero-actions hero-actions--kis"><a class="btn btn-primary btn--hero" href="/login">${t.loginSystem}</a></div></div></div></section>
    <div class="home-stats" data-countup-section><div class="container home-stats__inner"><div class="home-stat-item"><span class="home-stat-item__value gradient-text" data-countup="0" data-countup-suffix="+">0+</span><span class="home-stat-item__label">${t.employees}</span></div><div class="home-stat-item"><span class="home-stat-item__value gradient-text" data-countup="4">4</span><span class="home-stat-item__label">${t.openCourses}</span></div><div class="home-stat-item"><span class="home-stat-item__value gradient-text" data-countup="${learningHoursValue}" data-countup-locale="true">${learningHours}</span><span class="home-stat-item__label">${t.hours}</span></div></div></div>
    <section class="section--kis-banner"><div class="container"><a class="kis-about-banner-v2" href="/about-kis" data-reveal="scale"><img class="kis-about-banner-v2__image" data-lazy-public-image data-src="/public/images/hoiso.webp" alt="" width="2560" height="1642" decoding="async"><div class="kis-about-banner-v2__text"><span class="kis-about-banner-v2__eyebrow">${t.aboutEyebrow}</span><h2 class="kis-about-banner-v2__title">${t.aboutTitle}</h2><p class="kis-about-banner-v2__desc">${t.aboutDesc}</p></div><div class="kis-about-banner-v2__arrow" aria-hidden="true">→</div></a></div></section>
    <div class="home-final-cta" data-reveal="fade"><div class="container"><h2>${t.start}</h2><p>${t.startDesc}</p><a class="btn btn-primary" href="/login">${t.loginSystem}</a></div></div>
    <footer class="footer-v2"><div class="container footer-v2__grid"><div class="footer-v2__brand"><span class="footer-v2__brand-name">MyKIS Learning</span><p class="footer-v2__brand-desc">${t.footer}</p><span class="footer-v2__brand-badge">${t.employeeOnly}</span></div><nav class="footer-v2__col footer-v2__nav-col"><span class="footer-v2__col-heading">${t.quickLinks}</span><div class="footer-v2__links"><a href="/">${t.home}</a><a href="/about-kis">${t.about}</a><a href="/login">${t.login}</a></div></nav><div class="public-footer-contact-col"><span class="footer-v2__col-heading">${t.support}</span><div class="public-footer-contact-text"><span class="public-footer-contact-name">${t.supportName}</span><span class="public-footer-contact-role">${t.supportRole}</span><a class="public-footer-contact-email" href="mailto:${t.supportEmail}">${t.supportEmail}</a></div></div></div><div class="container footer-v2__bottom"><span>© 2026 KIS Vietnam Securities. All rights reserved.</span><span>${t.internal}</span>${languageSwitcher(language)}</div></footer>
  </div>`;

  app.querySelectorAll("[data-public-language]").forEach((button) => button.addEventListener("click", () => {
    localStorage.setItem("mykis-language", button.dataset.publicLanguage);
    render();
  }));
  removeMenuKeydown();
  const menuToggle = app.querySelector("[data-mobile-nav-toggle]");
  const menu = app.querySelector("#public-nav");
  const closeMenu = ({ restoreFocus = false } = {}) => {
    menu.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", t.menu);
    menuToggle.querySelector("span").textContent = "☰";
    if (restoreFocus) menuToggle.focus();
  };
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    if (!open) return closeMenu();
    menu.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", t.closeMenu);
    menuToggle.querySelector("span").textContent = "×";
    menu.querySelector("a")?.focus();
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => closeMenu()));
  const handleMenuKeydown = (event) => { if (event.key === "Escape" && menu.classList.contains("is-open")) closeMenu({ restoreFocus: true }); };
  document.addEventListener("keydown", handleMenuKeydown);
  removeMenuKeydown = () => document.removeEventListener("keydown", handleMenuKeydown);
  setupLandingMotion(language);
}

function setupLandingMotion(language) {
  const root = app.querySelector(".landing-page");
  if (!root) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const observers = [];
  let animationFrame = 0;
  root.classList.add("landing-motion-ready");

  const locale = language === "kr" ? "ko-KR" : language === "en" ? "en-US" : "vi-VN";
  const setCounterValue = (element, value) => {
    const suffix = element.dataset.countupSuffix || "";
    element.textContent = element.dataset.countupLocale === "true"
      ? `${new Intl.NumberFormat(locale).format(value)}${suffix}`
      : `${value}${suffix}`;
  };
  const runCounter = (element) => {
    const target = Number.parseInt(element.dataset.countup || "0", 10);
    if (!Number.isFinite(target) || reduced || target === 0) {
      setCounterValue(element, Math.max(0, target || 0));
      element.dataset.countupState = "complete";
      return;
    }
    element.dataset.countupState = "running";
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounterValue(element, Math.round(target * eased));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
      else element.dataset.countupState = "complete";
    };
    animationFrame = requestAnimationFrame(tick);
  };

  const stats = root.querySelector("[data-countup-section]");
  const revealStats = () => {
    stats?.classList.add("is-visible");
    stats?.querySelectorAll("[data-countup]").forEach(runCounter);
  };
  if (stats && !reduced && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      revealStats();
    }, { threshold: 0.3 });
    observer.observe(stats);
    observers.push(observer);
  } else {
    revealStats();
  }

  root.querySelectorAll("[data-reveal]").forEach((element) => {
    if (reduced || !("IntersectionObserver" in window)) return element.classList.add("is-visible");
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      element.classList.add("is-visible");
      observer.disconnect();
    }, { threshold: 0.16, rootMargin: "0px 0px -24px" });
    observer.observe(element);
    observers.push(observer);
  });

  root.querySelectorAll("[data-lazy-public-image]").forEach((image) => {
    const loadImage = () => {
      if (image.dataset.src) image.src = image.dataset.src;
      image.removeAttribute("data-src");
    };
    if (!("IntersectionObserver" in window)) return loadImage();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadImage();
      observer.disconnect();
    }, { rootMargin: "0px 0px 120px" });
    observer.observe(image);
    observers.push(observer);
  });

  cleanupMotion = () => {
    observers.forEach((observer) => observer.disconnect());
    if (animationFrame) cancelAnimationFrame(animationFrame);
  };
}

render();
