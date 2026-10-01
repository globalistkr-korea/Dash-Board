/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { getCurrency, subscribeCurrency, setCurrency } from '../lib/currency';
import { EN, CONTRACT_KO } from '../lib/labels';
import { CONTRACT_VI } from '../lib/vi';
import { getLanguage, setLanguage, subscribeLanguage, translateDisplay } from '../lib/i18n';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const currency = useSyncExternalStore(subscribeCurrency, getCurrency, () => 'vnd');
  const toggleCurrency = () => setCurrency(currency === 'vnd' ? 'krw' : 'vnd');
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'ko');
  const setLang = setLanguage;
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const toggleLang = () => setLang(lang === 'ko' ? 'en' : lang === 'en' ? 'vi' : 'ko');

  // 한글-원본 라벨 → 선택 언어
  const t = (ko) => lang === 'en' ? (EN[ko] || ko) : translateDisplay(ko);
  // 영문-원본(계약 필드) → 선택 언어
  const tf = (enKey) => lang === 'vi' ? (CONTRACT_VI[enKey] || translateDisplay(enKey)) : lang === 'ko' ? (CONTRACT_KO[enKey] || enKey) : enKey;

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t, tf, currency, toggleCurrency }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
