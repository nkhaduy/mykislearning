import { dictionaries, getInitialLanguage, saveLanguage } from "../../../lib/i18n/index.js";

const localeMap = { vi: "vi-VN", en: "en-US", kr: "ko-KR" };

function lookup(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}

function interpolate(value, variables = {}) {
  return String(value).replace(/\{([^}]+)\}/g, (_, key) => String(variables[key] ?? ""));
}

export function createI18n() {
  const language = getInitialLanguage();
  document.documentElement.lang = language === "kr" ? "ko" : language;
  return {
    language,
    locale: localeMap[language] || localeMap.vi,
    t(key, fallback = "", variables = {}) {
      const value = lookup(dictionaries[language], key) ?? lookup(dictionaries.vi, key) ?? fallback;
      return interpolate(value || fallback, variables);
    },
    pick(values) {
      return values?.[language] || values?.vi || values?.en || "";
    },
    setLanguage(nextLanguage) {
      if (!["vi", "en", "kr"].includes(nextLanguage)) return false;
      saveLanguage(nextLanguage);
      location.reload();
      return true;
    },
  };
}

export function formatDate(value, locale = "vi-VN", options = {}) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...options }).format(date);
}

export function formatDateTime(value, locale = "vi-VN") {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatNumber(value, locale = "vi-VN", options = {}) {
  return new Intl.NumberFormat(locale, options).format(Number(value) || 0);
}
