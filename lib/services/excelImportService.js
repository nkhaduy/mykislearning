import { getAccounts, getEmployees } from "../mockDatabase.js";

let xlsxLoader = null;

async function getXlsxRuntime() {
  if (window.XLSX) return window.XLSX;
  if (!xlsxLoader) {
    xlsxLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/xlsx.full.min.js";
      script.onload = () => resolve(window.XLSX);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return xlsxLoader;
}

function normalize(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalize(value).toLowerCase();
}

function previewSheetRows(sheet, headerRowIndex = 0, maxRows = 20) {
  const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = (matrix[headerRowIndex] || []).map((cell, index) => normalize(cell) || `Column ${index + 1}`);
  const rows = matrix.slice(headerRowIndex + 1, headerRowIndex + 1 + maxRows).map((row, rowIndex) => ({
    rowNumber: headerRowIndex + rowIndex + 2,
    values: headers.reduce((acc, header, index) => ({ ...acc, [header]: normalize(row[index]) }), {}),
  }));
  return { headers, rows, totalRows: Math.max(0, matrix.length - headerRowIndex - 1) };
}

const HEADER_ALIASES = {
  employeeCode: ["mã nhân viên", "employee id", "employee code", "code", "staff id"],
  fullName: ["họ và tên", "full name", "name", "employee name"],
  email: ["email", "email address", "company email"],
  department: ["department", "phòng ban", "division"],
  position: ["job title", "position", "chức danh", "title"],
  joinDate: ["join date", "ngày vào làm", "start date"],
  location: ["location", "địa điểm", "office"],
  defaultLanguage: ["language", "ngôn ngữ", "default language"],
  accountStatus: ["status", "trạng thái"],
  responseStatus: ["response", "registration status", "trạng thái đăng ký"],
  slot: ["slot", "buổi", "morning/afternoon"],
  checkIn: ["check in", "check-in", "giờ vào"],
  checkOut: ["check out", "check-out", "giờ ra"],
  attendanceStatus: ["attendance", "trạng thái điểm danh", "status attendance"],
  note: ["note", "ghi chú"],
};

function autoMapHeaders(headers, requiredFields) {
  const map = {};
  requiredFields.forEach((field) => {
    const aliases = HEADER_ALIASES[field] || [];
    const match = headers.find((header) => aliases.includes(normalizeKey(header)));
    if (match) map[field] = match;
  });
  return map;
}

export const excelImportService = {
  async parseWorkbook(file) {
    const XLSX = await getXlsxRuntime();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    return {
      fileName: file.name,
      fileSize: file.size,
      lastModified: file.lastModified,
      workbook,
      sheets: workbook.SheetNames.map((name) => ({ name, preview: previewSheetRows(workbook.Sheets[name], 0, 10) })),
    };
  },
  getSheetPreview(workbook, sheetName, headerRowIndex = 0, maxRows = 20) {
    const sheet = workbook?.Sheets?.[sheetName];
    if (!sheet) return { headers: [], rows: [], totalRows: 0 };
    return previewSheetRows(sheet, headerRowIndex, maxRows);
  },
  suggestMapping(headers, mode) {
    const fieldsByMode = {
      employees: ["employeeCode", "fullName", "email", "department", "position", "joinDate", "location", "defaultLanguage", "accountStatus"],
      participants: ["employeeCode", "email", "fullName", "department", "responseStatus"],
      attendance: ["employeeCode", "email", "slot", "checkIn", "checkOut", "attendanceStatus", "note"],
    };
    return autoMapHeaders(headers, fieldsByMode[mode] || []);
  },
  resolveRows(previewRows, mapping, mode) {
    const accounts = getAccounts();
    const employees = getEmployees();
    const accountByEmail = new Map(accounts.map((row) => [normalizeKey(row.email), row]));
    const accountByCode = new Map(accounts.map((row) => [normalizeKey(row.employeeCode), row]));
    const employeeByEmail = new Map(employees.map((row) => [normalizeKey(row.email), row]));
    const results = [];
    const seen = new Set();

    for (const row of previewRows) {
      const employeeCode = normalize(row.values[mapping.employeeCode]);
      const email = normalizeKey(row.values[mapping.email]);
      const fullName = normalize(row.values[mapping.fullName]);
      const account = accountByCode.get(normalizeKey(employeeCode)) || accountByEmail.get(email) || null;
      const employee = employeeByEmail.get(email) || (account ? employees.find((item) => item.accountId === account.id) : null) || null;
      const key = normalizeKey(employeeCode || email);
      let status = "valid";
      let message = "";
      if (!employeeCode && !email) {
        status = "error";
        message = "Thiếu mã nhân viên hoặc email.";
      } else if (key && seen.has(key)) {
        status = "error";
        message = "Dòng trùng với dữ liệu đã chọn trong file.";
      } else if (mode !== "employees" && !account) {
        status = "error";
        message = "Không tìm thấy nhân viên khớp mã/email.";
      } else if (account && (account.role !== "employee" || account.accountStatus === "disabled")) {
        status = "error";
        message = "Tài khoản không hợp lệ cho danh sách đào tạo.";
      }
      if (key) seen.add(key);
      results.push({
        rowNumber: row.rowNumber,
        employeeCode,
        email: normalize(row.values[mapping.email]),
        fullName,
        department: normalize(row.values[mapping.department]),
        position: normalize(row.values[mapping.position]),
        responseStatus: normalize(row.values[mapping.responseStatus]),
        slot: normalize(row.values[mapping.slot]),
        checkIn: normalize(row.values[mapping.checkIn]),
        checkOut: normalize(row.values[mapping.checkOut]),
        attendanceStatus: normalize(row.values[mapping.attendanceStatus]),
        note: normalize(row.values[mapping.note]),
        account,
        employee,
        status,
        message,
      });
    }
    return results;
  },
};
