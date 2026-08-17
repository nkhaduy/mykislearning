let app;

const copy = {
  vi: {
    home: "Trang chủ", about: "Về KIS", login: "Đăng nhập", quickLinks: "Liên kết nhanh",
    title: "Về KIS Việt Nam", subtitle: "Hành trình phát triển, nền tảng tài chính và sức mạnh con người tạo nên KIS Việt Nam.",
    founded: "Thành lập", capital: "Vốn điều lệ", stake: "Sở hữu KIS Korea", years: "Năm hoạt động",
    overviewEyebrow: "Tổng quan", overviewTitle: "Tổng quan KIS Việt Nam", timeline: "Hành trình phát triển",
    leadershipEyebrow: "Hội đồng Quản trị", leadership: "Ban Lãnh đạo", valuesEyebrow: "Giá trị cốt lõi", values: "Giá trị cốt lõi & Sứ mệnh",
    valuesLead: "Định hướng cách KIS xây dựng tổ chức, thúc đẩy đổi mới và tạo ra giá trị bền vững cho khách hàng.",
    philosophyEyebrow: "Triết lý", philosophy: "Triết lý tập đoàn", networkEyebrow: "Mạng lưới toàn cầu", network: "Mạng lưới KIS toàn cầu",
    networkLead: "KIS kết nối năng lực tài chính, đầu tư và quản trị quốc tế nhằm hỗ trợ sự phát triển bền vững tại thị trường Việt Nam.",
    ceoEyebrow: "Thông điệp lãnh đạo", ceo: "Lời Tổng Giám đốc", ceoRole: "Tổng Giám đốc",
    support: "Liên hệ hỗ trợ", supportName: "Nguyễn Thị Cẩm Thanh", supportRole: "Phòng Nhân sự", supportEmail: "thanh.ntc@kisvn.vn",
    internal: "Chỉ sử dụng nội bộ", footer: "Hệ thống đào tạo hội nhập và phát triển chuyên môn nội bộ", employeeOnly: "Dành riêng cho nhân viên KIS Việt Nam",
    selectYear: "Chọn năm", previousYear: "Năm trước", nextYear: "Năm sau", menu: "Mở menu", closeMenu: "Đóng menu",
  },
  en: {
    home: "Home", about: "About KIS", login: "Sign in", quickLinks: "Quick links",
    title: "About KIS Vietnam", subtitle: "A journey of growth, financial foundations and the strength of people that shape KIS Vietnam.",
    founded: "Founded", capital: "Charter capital", stake: "KIS Korea stake", years: "Years in operation",
    overviewEyebrow: "Company overview", overviewTitle: "About KIS Vietnam", timeline: "Development timeline",
    leadershipEyebrow: "Board of Directors", leadership: "Leadership", valuesEyebrow: "Core values", values: "Core Values & Mission",
    valuesLead: "Guiding how KIS builds its organization, drives transformation, and creates sustainable value for customers.",
    philosophyEyebrow: "Philosophy", philosophy: "Corporate Philosophy", networkEyebrow: "Global Network", network: "KIS Global Network",
    networkLead: "KIS connects financial, investment and international governance capabilities to support sustainable development in the Vietnamese market.",
    ceoEyebrow: "CEO Message", ceo: "Message from the CEO", ceoRole: "Chief Executive Officer",
    support: "Support", supportName: "Nguyễn Thị Cẩm Thanh", supportRole: "Human Resources Department", supportEmail: "thanh.ntc@kisvn.vn",
    internal: "Internal use only", footer: "Internal onboarding and professional development system", employeeOnly: "For KIS Vietnam employees only",
    selectYear: "Select year", previousYear: "Previous year", nextYear: "Next year", menu: "Open menu", closeMenu: "Close menu",
  },
  kr: {
    home: "홈", about: "KIS 소개", login: "로그인", quickLinks: "빠른 링크",
    title: "KIS Vietnam 소개", subtitle: "성장 여정과 금융 기반, 그리고 사람의 힘이 KIS Vietnam을 만듭니다.",
    founded: "설립", capital: "자본금", stake: "KIS Korea 지분", years: "운영 기간",
    overviewEyebrow: "회사 개요", overviewTitle: "KIS Vietnam 소개", timeline: "성장 연혁",
    leadershipEyebrow: "이사회", leadership: "경영진", valuesEyebrow: "핵심 가치", values: "핵심 가치 및 미션",
    valuesLead: "KIS가 조직을 구축하고 변화를 추진하며 고객을 위한 지속 가능한 가치를 창출하는 방향을 제시합니다.",
    philosophyEyebrow: "경영 철학", philosophy: "기업 철학", networkEyebrow: "글로벌 네트워크", network: "KIS 글로벌 네트워크",
    networkLead: "KIS는 금융, 투자, 국제 거버넌스 역량을 연결하여 베트남 시장에서의 지속 가능한 발전을 지원합니다.",
    ceoEyebrow: "대표 메시지", ceo: "대표이사의 말씀", ceoRole: "대표이사",
    support: "지원", supportName: "Nguyễn Thị Cẩm Thanh", supportRole: "인사부", supportEmail: "thanh.ntc@kisvn.vn",
    internal: "내부 전용", footer: "사내 온보딩 및 전문 역량 개발 시스템", employeeOnly: "KIS Vietnam 임직원 전용",
    selectYear: "연도 선택", previousYear: "이전 연도", nextYear: "다음 연도", menu: "메뉴 열기", closeMenu: "메뉴 닫기",
  },
};

const timeline = {
  2015: { image: "/legacy-public/images/timeline/2015.jpeg", width: 432, height: 288, events: ["Thành lập các phòng giao dịch Bà Triệu và Nguyễn Tri Phương.", "Tăng vốn điều lệ từ 264 tỷ đồng lên 1.113 tỷ đồng."] },
  2016: { image: "/legacy-public/images/timeline/2016.jpeg", width: 432, height: 268, events: ["Mở rộng mạng lưới tại Láng Hạ và Phạm Ngọc Thạch.", "Được vinh danh Top 10 thị phần môi giới tại HOSE và HNX."] },
  2018: { image: "/legacy-public/images/timeline/2018.png", width: 554, height: 366, events: ["Trở thành thành viên giao dịch chứng khoán phái sinh.", "Tăng vốn điều lệ lên 1.897 tỷ đồng."] },
  2019: { image: "/legacy-public/images/timeline/2019.jpeg", width: 432, height: 491, events: ["Là một trong bảy công ty đầu tiên được cấp chứng nhận phát hành chứng quyền.", "Chuyển chi nhánh Nguyễn Tri Phương thành chi nhánh Sài Gòn."] },
  2020: { image: "/legacy-public/images/timeline/2020.png", width: 581, height: 822, events: ["Tăng vốn điều lệ lên 2.596 tỷ đồng và tỷ lệ sở hữu KIS Korea lên 99,7%.", "Đạt Top 9 thị phần môi giới HOSE."] },
  2021: { image: "/legacy-public/images/timeline/2021.png", width: 514, height: 345, events: ["Tăng vốn điều lệ lên 3.761 tỷ đồng và tỷ lệ sở hữu KIS Korea lên 99,8%.", "Đạt Top 10 thị phần quý II tại HOSE."] },
  2025: { image: "/legacy-public/images/timeline/2025.jpeg", width: 1199, height: 800, events: ["Tăng vốn điều lệ lên 4.550 tỷ đồng.", "TOP 9 thị phần môi giới HOSE năm 2025."] },
};

const overview = {
  vi: [
    "Công ty Cổ phần Chứng khoán KIS Vietnam (KIS Vietnam) được thành lập vào tháng 12 năm 2010 bởi Công ty Cổ phần Đầu tư & Chứng khoán Hàn Quốc (KIS Korea), cùng với sự đầu tư của Tập đoàn Dệt may Việt Nam và các cổ đông khác. KIS Korea nắm giữ 48,8% cổ phần tại KIS Vietnam tính đến tháng 11 năm 2010 và đã dần dần tăng cường sở hữu trong những năm qua, với tỷ lệ sở hữu chính thức hiện tại là <strong>99,8%</strong>.",
    "Trong suốt <strong>15 năm</strong> hoạt động tại thị trường Việt Nam, KIS Vietnam đã liên tục tăng vốn để mở rộng các hoạt động kinh doanh của công ty, với tổng vốn điều lệ đạt <strong>4.550 tỷ VND</strong>, và con số này sẽ tiếp tục tăng trong tương lai.",
    "KIS Vietnam nhận được sự hỗ trợ mạnh mẽ từ Tập đoàn KIS tại Hàn Quốc, tận dụng kinh nghiệm trong lĩnh vực tài chính và sự hợp tác của các chuyên gia nước ngoài cùng đội ngũ nhân viên xuất sắc có nhiều năm kinh nghiệm trong ngân hàng, kiểm toán và thị trường vốn trong nước.",
  ],
  en: [
    "Korea Investment & Securities Vietnam (KIS Vietnam) was established in December 2010 by Korea Investment & Securities (KIS Korea), together with investment from Vietnam National Textile and Garment Group and other shareholders. KIS Korea held 48.8% of shares in November 2010 and has gradually increased its stake to the current official ownership of <strong>99.8%</strong>.",
    "Over <strong>15 years</strong> of operation in Vietnam, KIS Vietnam has continuously increased capital to expand its business activities, with total charter capital reaching <strong>4,550 billion VND</strong>, and this figure will continue to grow.",
    "KIS Vietnam receives strong support from the KIS Group in Korea, leveraging financial expertise and collaboration from foreign experts and outstanding employees with years of experience in banking, auditing, and domestic capital markets.",
  ],
  kr: [
    "한국투자증권 베트남(KIS Vietnam)은 2010년 12월 한국투자증권(KIS Korea)에 의해 설립되었으며, 베트남 섬유의류그룹 등과 함께 투자되었습니다. KIS Korea는 2010년 11월 기준 48.8%의 지분을 보유했으며, 이후 지속적으로 지분을 늘려 현재 <strong>99.8%</strong>의 공식 지분율을 기록하고 있습니다.",
    "베트남 시장에서 <strong>15년 이상</strong> 운영하는 동안, KIS Vietnam은 사업 영역을 확장하기 위해 지속적으로 자본을 증가시켜 왔으며, 총 자본금은 <strong>4,550억 VND</strong>에 달합니다.",
    "KIS Vietnam은 한국 KIS그룹의 강력한 지원을 받아 국제 금융 분야의 경험과 외국 전문가들의 협력, 은행·감사·자본시장 분야에서 다년간 경험을 쌓은 우수 인재들을 활용하고 있습니다.",
  ],
};

const values = [
  { num: "01", icon: "target", name: { vi: "Tổ chức hướng đến mục tiêu", en: "Goal-Oriented Organization", kr: "목표 지향적 조직" }, desc: { vi: "Xác lập mục tiêu rõ ràng, phối hợp hiệu quả và tập trung nguồn lực để tạo ra kết quả đo lường được.", en: "Setting clear objectives, coordinating effectively, and focusing resources to deliver measurable results.", kr: "명확한 목표를 설정하고 효과적으로 협업하며 자원을 집중하여 측정 가능한 성과를 창출합니다." } },
  { num: "02", icon: "check", name: { vi: "Tổ chức thúc đẩy chuyển đổi", en: "A Transformative Organization", kr: "변화를 주도하는 조직" }, desc: { vi: "Không ngừng đổi mới phương thức làm việc, ứng dụng công nghệ và phát triển năng lực để thích ứng với thay đổi.", en: "Continuously improving ways of working, adopting technology, and building capabilities to adapt to change.", kr: "업무 방식을 지속적으로 개선하고 기술을 도입하며 변화에 대응할 수 있는 역량을 강화합니다." } },
  { num: "03", icon: "users", name: { vi: "Công ty lấy khách hàng làm trọng tâm", en: "A Customer-Focused Company", kr: "고객 중심 기업" }, desc: { vi: "Thấu hiểu nhu cầu khách hàng, nâng cao trải nghiệm và tạo ra giải pháp tài chính có giá trị lâu dài.", en: "Understanding customer needs, improving experiences, and delivering financial solutions with long-term value.", kr: "고객의 요구를 이해하고 경험을 향상시키며 장기적인 가치를 제공하는 금융 솔루션을 제공합니다." } },
];

const philosophies = {
  vi: [["Làm hài lòng khách hàng", ["Khách hàng là lý do mà công ty chứng khoán tồn tại.", "Ra quyết định dựa trên góc nhìn của khách hàng.", "Phát triển cùng với khách hàng bằng cách đảm bảo sự hài lòng của họ."]], ["Kiến tạo giá trị mới", ["Liên tục tạo ra giá trị mới cho xã hội.", "Đổi mới với tinh thần thử thách bằng cách nâng cao năng lực tổ chức.", "Theo đuổi những mục tiêu cao nhất và sự xuất sắc."]], ["Tôn trọng cá nhân", ["Chúng tôi luôn tôn trọng từng cá nhân trong đội ngũ của mình.", "Khuyến khích cá nhân phát triển khả năng của họ tại nơi làm việc.", "Hỗ trợ mỗi cá nhân trở thành những nhân viên xuất sắc."]]],
  en: [["Customer Satisfaction", ["Customers are the reason a securities company exists.", "Make decisions based on the customer's perspective.", "Grow with customers by ensuring their satisfaction."]], ["Creating New Value", ["Continuously create new value for society.", "Innovate with a spirit of challenge by enhancing organizational capability.", "Pursue the highest goals and excellence."]], ["Respecting the Individual", ["We always respect each individual on our team.", "Encourage individuals to develop their abilities in the workplace.", "Support each individual to become outstanding employees."]]],
  kr: [["고객 만족", ["증권회사가 존재하는 이유는 고객입니다.", "고객의 관점에서 의사결정을 내립니다.", "고객 만족을 통해 고객과 함께 성장합니다."]], ["새로운 가치 창출", ["사회를 위해 지속적으로 새로운 가치를 창출합니다.", "조직 역량을 강화하여 도전 정신으로 혁신합니다.", "최고의 목표와 탁월함을 추구합니다."]], ["개인 존중", ["팀의 모든 개인을 항상 존중합니다.", "직장에서 개인이 자신의 능력을 발전시킬 수 있도록 장려합니다.", "각 개인이 탁월한 직원이 되도록 지원합니다."]]],
};

function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function language() { const saved = localStorage.getItem("mykis-language"); return ["vi", "en", "kr"].includes(saved) ? saved : "vi"; }
function languageSwitcher(current) { return `<div class="language-switch" data-active-lang="${current}">${["vi", "en", "kr"].map((item) => `<button type="button" class="${item === current ? "active" : ""}" data-public-language="${item}" aria-pressed="${item === current}">${item.toUpperCase()}</button>`).join("")}</div>`; }
function icon(name) {
  const paths = { target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', check: '<path d="m5 12 4 4L19 6"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.2 2.6-5 6-5s6 1.8 6 5"/><path d="M16 6.5a3 3 0 0 1 0 5.8M17 15c2.4.4 4 2 4 5"/>' };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.check}</svg>`;
}

let removeMenuKeydown = () => {};

function timelinePanel(year) {
  const item = timeline[year];
  return `<div class="timeline-carousel__content-inner" data-active-year="${year}"><div class="timeline-carousel__watermark" aria-hidden="true">${year}</div><div class="timeline-carousel__image"${year === "2020" ? ' data-year="2020"' : ""}><img src="${item.image}" alt="KIS Vietnam ${year}" width="${item.width}" height="${item.height}" loading="lazy" decoding="async"></div><div class="timeline-carousel__info"><h3 class="timeline-carousel__year-big">${year}</h3><ul class="timeline-carousel__events">${item.events.map((event, index) => `<li style="--i:${index}">${esc(event)}</li>`).join("")}</ul></div></div>`;
}

function render() {
  const current = language();
  const t = copy[current];
  const years = Object.keys(timeline);
  document.documentElement.lang = current === "kr" ? "ko" : current;
  document.title = current === "vi" ? "Về KIS | MyKIS Learning" : `${t.about} | MyKIS Learning`;
  const leaders = [
    ["/legacy-public/images/about/leader-shin-hyun-jae.jpg", "Shin Hyun Jae", "Tổng Giám đốc kiêm Chủ tịch Hội đồng Quản trị", "CEO & Chairman of the Board", "대표이사 겸 이사회 의장", 1080, 1389],
    ["/legacy-public/images/about/leader-cho-hun-hee.jpg", "Cho Hun Hee", "Giám đốc cấp cao Khối Hoạt động & KHCN, Thành viên HĐQT", "Senior Director of Operations & IT, Board Member", "운영·IT 부문 고위이사, 이사회 이사", 1080, 1384],
    ["/legacy-public/images/about/leader-choi-eun-suk.jpg", "Choi Eun Suk", "Thành viên Hội đồng Quản trị", "Member of the Board", "이사회 이사", 1050, 1470],
  ];
  const leaderRoles = leaders.map((leader) => current === "vi" ? leader[2] : current === "en" ? leader[3] : leader[4]);
  const networks = current === "vi" ? [["Korea Investment & Securities (KIS)", "8 công ty con · 1 văn phòng đại diện"], ["Korea Investment Management (KIM)", "1 công ty con · 1 văn phòng đại diện"], ["Korea Investment Partners (KIP)", "1 công ty con · 2 văn phòng đại diện"], ["KIARA Advisors", "Global advisory network"]] : current === "en" ? [["Korea Investment & Securities (KIS)", "8 subsidiaries · 1 representative office"], ["Korea Investment Management (KIM)", "1 subsidiary · 1 representative office"], ["Korea Investment Partners (KIP)", "1 subsidiary · 2 representative offices"], ["KIARA Advisors", "Global advisory network"]] : [["Korea Investment & Securities (KIS)", "자회사 8개 · 대표사무소 1개"], ["Korea Investment Management (KIM)", "자회사 1개 · 대표사무소 1개"], ["Korea Investment Partners (KIP)", "자회사 1개 · 대표사무소 2개"], ["KIARA Advisors", "글로벌 자문 네트워크"]];
  const ceoLetter = current === "vi" ? ["Kính gửi Quý Nhà đầu tư và Đối tác,", "Thay mặt Công ty Cổ phần Chứng khoán KIS Việt Nam, tôi xin gửi lời cảm ơn chân thành tới Quý Nhà đầu tư và Đối tác đã luôn tin tưởng, đồng hành và ủng hộ KIS Việt Nam trong suốt chặng đường phát triển hơn 15 năm qua.", "Ngay từ những ngày đầu thành lập, KIS Việt Nam luôn kiên định với định hướng lấy khách hàng làm trung tâm, không ngừng nâng cao chất lượng dịch vụ và ứng dụng công nghệ hiện đại nhằm mang đến các sản phẩm, giải pháp tài chính toàn diện cho nhà đầu tư cá nhân, tổ chức trong nước và quốc tế.", "Với mục tiêu trở thành một trong những định chế tài chính hàng đầu trên thị trường vốn Việt Nam, KIS Việt Nam không chỉ kế thừa nền tảng tài chính vững mạnh, kinh nghiệm quản trị và mạng lưới toàn cầu từ KIS Hàn Quốc, mà còn không ngừng đầu tư vào nguồn nhân lực chất lượng cao, công nghệ và hạ tầng giao dịch hiện đại để nâng cao trải nghiệm khách hàng.", "Sở hữu đội ngũ chuyên gia giàu kinh nghiệm cùng sự hỗ trợ từ các giải pháp công nghệ tiên tiến, chúng tôi cam kết tiếp tục đồng hành cùng Quý khách hàng và đối tác trên hành trình đầu tư, mang đến những giá trị thiết thực, bền vững và hiệu quả.", "Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý vị. Kính chúc Quý Nhà đầu tư, Đối tác cùng gia đình sức khỏe, hạnh phúc và thành công.", "Trân trọng."] : current === "en" ? ["Dear Investors and Partners,", "On behalf of KIS Vietnam Securities, I would like to extend my sincere gratitude to all investors and partners who have always trusted, accompanied, and supported KIS Vietnam throughout our 15-year journey of development.", "From our earliest days, KIS Vietnam has remained steadfast in its customer-centric direction, continuously improving service quality and applying modern technology to bring comprehensive financial products and solutions to individual and institutional investors, both domestic and international.", "With the goal of becoming one of the leading financial institutions in Vietnam's capital market, KIS Vietnam not only inherits the strong financial foundation, management experience, and global network from KIS Korea, but also continuously invests in high-quality human resources, technology, and modern trading infrastructure to enhance the customer experience.", "With a team of experienced experts and the support of advanced technology solutions, we are committed to continuing to accompany our customers and partners on their investment journey, delivering practical, sustainable, and effective values.", "Once again, I sincerely thank you for your trust and companionship. I wish all investors, partners and their families health, happiness and success.", "Respectfully."] : ["존경하는 투자자 및 파트너 여러분,", "15년 이상의 성장 과정에서 KIS Vietnam을 신뢰하고 함께해 주신 모든 분께 감사드립니다.", "KIS Vietnam은 고객 중심의 방향을 지키며 서비스 품질을 높이고 현대 기술을 적용해 국내외 투자자에게 금융 상품과 솔루션을 제공해 왔습니다.", "베트남 자본 시장의 선도 금융기관을 목표로 KIS Korea의 금융 기반과 글로벌 네트워크를 계승하고, 인재·기술·현대적 거래 인프라에 지속적으로 투자하고 있습니다.", "풍부한 경험을 갖춘 전문가 팀과 첨단 기술 솔루션을 바탕으로 실질적이고 지속 가능한 가치를 제공하겠습니다.", "여러분의 신뢰와 동행에 다시 한번 감사드리며 건강과 성공을 기원합니다.", "진심을 담아."];

  app.innerHTML = `<div class="page about-page">
    <a class="skip-link" href="#main-content">${current === "vi" ? "Đến nội dung chính" : current === "en" ? "Skip to main content" : "본문으로 건너뛰기"}</a>
    <header class="header"><div class="container header-inner"><a class="brand" href="/"><img class="brand-logo" src="/legacy-public/assets/kis-logo-horizontal.png" alt="KIS" width="700" height="92" decoding="async"><span>MyKIS Learning</span></a><nav class="nav" id="public-nav" aria-label="${t.quickLinks}"><a href="/">${t.home}</a><a href="/about-kis" aria-current="page" class="is-active">${t.about}</a></nav><div class="header-actions">${languageSwitcher(current)}<button class="mobile-nav-toggle" type="button" data-mobile-nav-toggle aria-controls="public-nav" aria-expanded="false" aria-label="${t.menu}"><span aria-hidden="true">☰</span></button><a class="btn btn-primary header-mobile-cta" href="/login">${t.login}</a><a class="btn btn-primary btn--hero header-desktop-login" href="/login">${t.login}</a></div></div></header>
    <section class="about-hero-v2"><div class="about-hero-v2__inner"><div><h1 class="about-hero-v2__title">${t.title}</h1><p class="about-hero-v2__subtitle">${t.subtitle}</p></div><div class="about-hero-v2__stats"><div class="about-hero-stat"><span class="about-hero-stat__value">12/2010</span><span class="about-hero-stat__label">${t.founded}</span></div><div class="about-hero-stat"><span class="about-hero-stat__value">4.550 tỷ</span><span class="about-hero-stat__label">${t.capital}</span></div><div class="about-hero-stat"><span class="about-hero-stat__value">99.8%</span><span class="about-hero-stat__label">${t.stake}</span></div><div class="about-hero-stat"><span class="about-hero-stat__value">15+</span><span class="about-hero-stat__label">${t.years}</span></div></div></div></section>
    <main id="main-content">
      <section class="overview-section-v2" id="kis-overview"><div class="container overview-split-v2"><div class="overview-text-col"><span class="eyebrow">${t.overviewEyebrow}</span><h2 class="section-title">${t.overviewTitle}</h2><div class="overview-copy-v2">${overview[current].map((paragraph) => `<p>${paragraph}</p>`).join("")}</div></div><aside class="overview-stats-panel" aria-label="${t.overviewTitle}"><div class="overview-stat-item"><span class="overview-stat-item__val">12/2010</span><span class="overview-stat-item__label">${t.founded}</span></div><div class="overview-stat-item"><span class="overview-stat-item__val">99.8%</span><span class="overview-stat-item__label">${t.stake}</span></div><div class="overview-stat-item"><span class="overview-stat-item__val">4.550 tỷ</span><span class="overview-stat-item__label">${t.capital}</span></div><div class="overview-stat-item"><span class="overview-stat-item__val">15+</span><span class="overview-stat-item__label">${t.years}</span></div></aside></div></section>
      <section class="timeline-carousel" id="kis-history" data-timeline-entry><div class="container"><div class="timeline-carousel__header"><h2 class="section-title">${t.timeline}</h2><div class="timeline-carousel__nav-buttons"><button class="timeline-carousel__btn timeline-carousel__btn--prev" type="button" aria-label="${t.previousYear}">‹</button><button class="timeline-carousel__btn timeline-carousel__btn--next" type="button" aria-label="${t.nextYear}" disabled>›</button></div></div><div class="timeline-carousel__years" role="tablist" aria-label="${t.selectYear}" style="--active-index:6;--total-years:7"><div class="timeline-carousel__years-line" aria-hidden="true"></div><div class="timeline-carousel__years-progress" aria-hidden="true"></div>${years.map((year) => `<button id="timeline-year-${year}" class="timeline-carousel__year${year === "2025" ? " is-active" : ""}" type="button" role="tab" aria-controls="timeline-panel" aria-current="${year === "2025" ? "true" : "false"}" aria-selected="${year === "2025"}" tabindex="${year === "2025" ? "0" : "-1"}" data-timeline-year="${year}"><span class="timeline-carousel__year-label">${year}</span><span class="timeline-carousel__year-dot" aria-hidden="true"></span></button>`).join("")}</div><div id="timeline-panel" class="timeline-carousel__content" role="tabpanel" tabindex="0" aria-labelledby="timeline-year-2025" aria-live="polite">${timelinePanel("2025")}</div></div></section>
      <section class="board-section" id="kis-leadership"><div class="container"><div class="section-head"><span class="eyebrow">${t.leadershipEyebrow}</span><h2 class="section-title">${t.leadership}</h2></div><div class="board-grid">${leaders.map((leader, index) => `<article class="board-member"><div class="board-member__photo-frame"><img class="board-member__photo" src="${leader[0]}" alt="${esc(leader[1])}" width="${leader[5]}" height="${leader[6]}" loading="lazy" decoding="async"></div><div class="board-member__info"><h3 class="board-member__name">${esc(leader[1])}</h3><p class="board-member__role">${esc(leaderRoles[index])}</p></div></article>`).join("")}</div></div></section>
      <section class="core-values-v2"><div class="container"><div class="section-head"><div><span class="eyebrow">${t.valuesEyebrow}</span><h2 class="section-title">${t.values}</h2><p class="section-lead">${t.valuesLead}</p></div></div><div class="core-values-grid">${values.map((value) => `<article class="core-value-v2"><span class="core-value-v2__num" aria-hidden="true">${value.num}</span><div class="core-value-v2__icon">${icon(value.icon)}</div><h3 class="core-value-v2__title">${esc(value.name[current])}</h3><p class="core-value-v2__desc">${esc(value.desc[current])}</p></article>`).join("")}</div></div></section>
      <section class="philosophy-v2"><div class="container"><div class="section-head"><div><span class="eyebrow">${t.philosophyEyebrow}</span><h2 class="section-title">${t.philosophy}</h2></div></div><div class="philosophy-pillars">${philosophies[current].map(([title, bullets], index) => `<article class="pillar-v2"><span class="pillar-v2__number" aria-hidden="true">0${index + 1}</span><div class="pillar-v2__icon">${icon("check")}</div><h3 class="pillar-v2__title">${esc(title)}</h3><ul class="pillar-v2__body">${bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul></article>`).join("")}</div></div></section>
      <section class="network-v2"><div class="container"><div class="section-head"><div><span class="eyebrow">${t.networkEyebrow}</span><h2 class="section-title">${t.network}</h2><p class="section-lead">${t.networkLead}</p></div></div><div class="network-cards-v2">${networks.map(([title, meta]) => `<article class="network-card-v2"><h3 class="network-card-v2__title">${esc(title)}</h3><p class="network-card-v2__meta">${esc(meta)}</p></article>`).join("")}</div><div class="network-reference-map"><picture><source srcset="/legacy-public/images/about/global-network.webp" type="image/webp"><img src="/legacy-public/images/about/global-network.png" alt="${esc(t.network)}" width="3840" height="2160" loading="lazy" decoding="async"></picture></div></div></section>
      <section class="ceo-v2"><div class="container"><div class="section-head"><div><span class="eyebrow">${t.ceoEyebrow}</span><h2 class="section-title">${t.ceo}</h2></div></div><div class="ceo-card-v2"><span class="ceo-card-v2__quote" aria-hidden="true">&quot;</span><div class="ceo-card-v2__photo"><img src="/legacy-public/images/about/tgd.jpeg" alt="Shin, Hyun Jae" width="1920" height="1664" loading="lazy" decoding="async"></div><div class="ceo-card-v2__body"><h3 class="ceo-card-v2__name">Shin, Hyun Jae</h3><span class="ceo-card-v2__role">${t.ceoRole}</span><div class="ceo-card-v2__letter">${ceoLetter.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</div></div></div></div></section>
    </main>
    <footer class="footer-v2"><div class="container footer-v2__grid"><div class="footer-v2__brand"><span class="footer-v2__brand-name">MyKIS Learning</span><p class="footer-v2__brand-desc">${t.footer}</p><span class="footer-v2__brand-badge">${t.employeeOnly}</span></div><nav class="footer-v2__col footer-v2__nav-col"><span class="footer-v2__col-heading">${t.quickLinks}</span><div class="footer-v2__links"><a href="/">${t.home}</a><a href="/about-kis">${t.about}</a><a href="/login">${t.login}</a></div></nav><div class="public-footer-contact-col"><span class="footer-v2__col-heading">${t.support}</span><div class="public-footer-contact-text"><span class="public-footer-contact-name">${t.supportName}</span><span class="public-footer-contact-role">${t.supportRole}</span><a class="public-footer-contact-email" href="mailto:${t.supportEmail}">${t.supportEmail}</a></div></div></div><div class="container footer-v2__bottom"><span>© 2026 KIS Vietnam Securities. All rights reserved.</span><span>${t.internal}</span>${languageSwitcher(current)}</div></footer>
  </div>`;

  let activeYear = "2025";
  const centerActiveYear = () => {
    const yearList = app.querySelector(".timeline-carousel__years");
    const activeButton = yearList?.querySelector(".timeline-carousel__year.is-active");
    if (!yearList || !activeButton || !window.matchMedia("(max-width: 900px)").matches) return;
    yearList.scrollLeft = activeButton.offsetLeft - ((yearList.clientWidth - activeButton.offsetWidth) / 2);
  };
  const activateYear = (year, focus = false) => {
    if (!timeline[year]) return;
    activeYear = year;
    const activeIndex = years.indexOf(year);
    const yearList = app.querySelector(".timeline-carousel__years");
    yearList.style.setProperty("--active-index", activeIndex);
    app.querySelectorAll("[data-timeline-year]").forEach((button) => {
      const active = button.dataset.timelineYear === year;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("aria-current", String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    const panel = app.querySelector("#timeline-panel");
    panel.setAttribute("aria-labelledby", `timeline-year-${year}`);
    panel.innerHTML = timelinePanel(year);
    app.querySelector(".timeline-carousel__btn--prev").disabled = activeIndex === 0;
    app.querySelector(".timeline-carousel__btn--next").disabled = activeIndex === years.length - 1;
    requestAnimationFrame(centerActiveYear);
  };
  app.querySelectorAll("[data-timeline-year]").forEach((button) => button.addEventListener("click", () => activateYear(button.dataset.timelineYear)));
  app.querySelector(".timeline-carousel__btn--prev").addEventListener("click", () => activateYear(years[Math.max(0, years.indexOf(activeYear) - 1)], true));
  app.querySelector(".timeline-carousel__btn--next").addEventListener("click", () => activateYear(years[Math.min(years.length - 1, years.indexOf(activeYear) + 1)], true));
  app.querySelector(".timeline-carousel__years").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Enter" || event.key === " ") return activateYear(event.target.dataset.timelineYear);
    const index = years.indexOf(activeYear);
    const next = event.key === "Home" ? years[0] : event.key === "End" ? years.at(-1) : years[Math.max(0, Math.min(years.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))];
    activateYear(next, true);
  });
  requestAnimationFrame(centerActiveYear);
  app.querySelectorAll("[data-public-language]").forEach((button) => button.addEventListener("click", () => { localStorage.setItem("mykis-language", button.dataset.publicLanguage); render(); }));
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
}

export function mountLegacyAbout(container) {
  app = container;
  render();
  return () => {
    removeMenuKeydown();
    app.replaceChildren();
    app = null;
  };
}
