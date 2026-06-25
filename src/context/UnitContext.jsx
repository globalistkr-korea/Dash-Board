/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { KRW_RATE_DEFAULT } from '../lib/format';

const UnitContext = createContext(null);
const KEY = 'vn_dashboard_ui';
const initUI = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};

export function UnitProvider({ children }) {
  const saved = initUI();
  const [unit, setUnit] = useState(saved.unit === 'krw' ? 'krw' : 'vnd'); // 'vnd'(백만동) | 'krw'(백만원)
  const [rate, setRate] = useState(saved.rate || KRW_RATE_DEFAULT);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ unit, rate }));
  }, [unit, rate]);

  const toggleUnit = () => setUnit((u) => (u === 'vnd' ? 'krw' : 'vnd'));

  return (
    <UnitContext.Provider value={{ unit, setUnit, toggleUnit, rate, setRate }}>
      {children}
    </UnitContext.Provider>
  );
}

export const useUnit = () => useContext(UnitContext);
