// Display preference only. Analysis and stored amounts always remain million VND.
import { translateDisplay } from './i18n';
export const KRW_REFERENCE_RATE = 0.056;
const KEY = 'vn_dashboard_currency';
const listeners = new Set();
let currency = 'vnd';
try { if (localStorage.getItem(KEY) === 'krw') currency = 'krw'; } catch { /* optional local preference */ }
export const getCurrency = () => currency;
export const subscribeCurrency = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function setCurrency(value) {
  if (!['vnd', 'krw'].includes(value) || value === currency) return;
  currency = value;
  try { localStorage.setItem(KEY, value); } catch { /* preference stays in memory */ }
  listeners.forEach(listener => listener());
}
export const convertDisplayAmount = value => currency === 'krw' ? value * KRW_REFERENCE_RATE : value;
export const smallMoneyLabel = () => translateDisplay(currency === 'krw' ? '백만원' : '백만동');
export const largeMoneyLabel = () => translateDisplay(currency === 'krw' ? '억원' : '십억동');
export const largeDisplayAmount = value => convertDisplayAmount(value) / (currency === 'krw' ? 100 : 1000);
export const formatSmallMoney = value => value == null || !Number.isFinite(value) ? '-' : convertDisplayAmount(value).toLocaleString('ko-KR', { maximumFractionDigits: currency === 'krw' ? 1 : 0 });
export const formatLargeMoney = value => value == null || !Number.isFinite(value) ? '-' : largeDisplayAmount(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
