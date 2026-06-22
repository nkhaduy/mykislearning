import { vi } from "./vi.js";
import { en } from "./en.js";
import { kr } from "./kr.js";

export const dictionaries = { vi, en, kr };

export function getInitialLanguage() {
  const saved = localStorage.getItem("mykis-language");
  return ["vi", "en", "kr"].includes(saved) ? saved : "vi";
}

export function saveLanguage(language) {
  localStorage.setItem("mykis-language", language);
}
