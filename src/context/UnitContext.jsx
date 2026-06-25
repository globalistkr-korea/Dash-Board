import { createContext, useContext, useState, useEffect } from 'react';
import { KRW_RATE_DEFAULT } from '../lib/format';

const UnitContext = createContext(null);
const KEY = 'vn_dashboard_ui';

export function UnitProvider({ children }) {
  const [unit, setUnit] = useState('vnd'); // 'vnd'(백만동) | 'krw'(백만원)
  const [rate, setRate] = useState(KRW_RATE_DEFAULT);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (s.unit) setUnit(s.unit);
      if (s.rate) setRate(s.rate);
    } catch { /* ignore */ }
  }, []);

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
