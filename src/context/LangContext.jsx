import { createContext, useContext, useState, useEffect } from 'react';
import { EN, CONTRACT_KO } from '../lib/labels';

const LangContext = createContext(null);
const KEY = 'vn_dashboard_lang';

export function LangProvider({ children }) {
  const [lang, setLang] = useState('ko'); // 'ko' | 'en'
  useEffect(() => {
    const s = localStorage.getItem(KEY);
    if (s === 'ko' || s === 'en') setLang(s);
  }, []);
  useEffect(() => { localStorage.setItem(KEY, lang); }, [lang]);
  const toggleLang = () => setLang((l) => (l === 'ko' ? 'en' : 'ko'));

  // 한글-원본 라벨 → 선택 언어
  const t = (ko) => (lang === 'en' ? (EN[ko] || ko) : ko);
  // 영문-원본(계약 필드) → 선택 언어
  const tf = (enKey) => (lang === 'ko' ? (CONTRACT_KO[enKey] || enKey) : enKey);

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t, tf }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
