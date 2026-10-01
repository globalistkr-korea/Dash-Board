import { EN } from './labels';
import { VI, VI_TEMPLATES, KO_VI } from './vi';

const KEY = 'vn_dashboard_lang';
const languages = ['ko', 'en', 'vi'];
const listeners = new Set();
let language = 'ko';
try { const stored = localStorage.getItem(KEY); if (languages.includes(stored)) language = stored; } catch { /* optional preference */ }
export const getLanguage = () => language;
export const subscribeLanguage = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function setLanguage(value) {
  if (!languages.includes(value) || value === language) return;
  language = value;
  try { localStorage.setItem(KEY, value); } catch { /* keep in memory */ }
  listeners.forEach(listener => listener());
}
const escape = text => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const templates = VI_TEMPLATES.map(([source, translation]) => {
  const slots = [];
  const parts = source.split(/(\{\d+\})/g).map(part => {
    if (/^\{\d+\}$/.test(part)) { slots.push(Number(part.slice(1,-1))); return '(.*?)'; }
    return escape(part);
  });
  return { pattern: new RegExp('^' + parts.join('') + '$'), slots, translation, specificity: source.replace(/\{\d+\}/g, '').length };
}).sort((a,b) => b.specificity - a.specificity);

export function translateVietnamese(text) {
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (Object.hasOwn(VI, trimmed)) return text.replace(trimmed, VI[trimmed]);
  if (Object.hasOwn(KO_VI, trimmed)) return text.replace(trimmed, KO_VI[trimmed]);
  for (const { pattern, slots, translation } of templates) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const values = Object.fromEntries(slots.map((slot,i) => [slot,match[i+1]]));
    let result = translation.replace(/\{(\d+)\}/g, (_,slot) => values[slot] ?? '');
    for (const phrase of ['Repeated across months; potentially structural.', 'Check whether the increase is period-specific.']) result = result.replaceAll(phrase, VI[phrase]);
    return text.replace(trimmed,result);
  }
  if (EN[trimmed] && EN[trimmed] !== trimmed) return translateVietnamese(EN[trimmed]);
  // Numeric period labels only: never rewrite warehouse/customer identifiers.
  return text.replace(/(\d{4})년 (\d+)월까지 입력 실적 · 이후 미입력/g,'Đã nhập đến tháng $2/$1 · các tháng sau chưa nhập')
    .replace(/(\d{4})년/g,'Năm $1').replace(/(\d+)월/g,'Tháng $1');
}

export function localizeText(ko, en, lang = language) {
  return lang === 'vi' ? translateVietnamese(en ?? ko) : lang === 'en' ? (en ?? EN[ko] ?? ko) : ko;
}
export const translateDisplay = text => language === 'vi' ? translateVietnamese(text) : language === 'en' ? (EN[text] ?? text) : text;
