import { localizeText, translateDisplay } from "../lib/i18n";
import { BarChart2, Users, Warehouse, FileText, TrendingUp, RefreshCw } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useVersionCheck, applyUpdate } from '../lib/useVersionCheck';

const NAV_ITEMS = [
  { id: 'plan',      label: '경영실적',  icon: TrendingUp },
  { id: 'warehouse', label: '창고별',    icon: Warehouse  },
  { id: 'customer',  label: '고객사별',  icon: Users      },
  { id: 'contract',  label: '계약',      icon: FileText   },
];

function CurrencyToggle() {
  const { currency, toggleCurrency } = useLang();
  return <button onClick={toggleCurrency} aria-label={translateDisplay("통화 전환")} aria-pressed={currency === 'krw'}
    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-blue-700/60 hover:bg-blue-700 text-xs font-semibold text-white"
    title={translateDisplay("원화 / 베트남동 전환 · 원화는 참고 환율 1 VND = 0.056원")}>
    <span className={currency === 'krw' ? 'text-white' : 'text-blue-300'}>{translateDisplay("원")}</span><span className="text-blue-400">/</span><span className={currency === 'vnd' ? 'text-white' : 'text-blue-300'}>{translateDisplay("동")}</span>
  </button>;
}

function LangToggle() {
  const { lang, setLang } = useLang();
  return <div role="group" aria-label="한국어 / English / Tiếng Việt" className="flex items-center rounded-full bg-blue-700/60 p-0.5 text-xs font-semibold">
    {[['ko','한','한국어'],['en','EN','English'],['vi','VI','Tiếng Việt']].map(([value,label,name]) => <button key={value} onClick={() => setLang(value)} aria-label={name} aria-pressed={lang === value}
      className={`rounded-full px-2 py-1 transition-colors ${lang === value ? 'bg-white text-blue-800' : 'text-blue-200 hover:text-white'}`}>{label}</button>)}
  </div>;
}

// (구)UnitToggle: 소비하는 화면이 없어 아무 효과가 없던 죽은 토글 — 제거(2026-07).
// 단위는 화면별 고정: 경영계획=원화(억원/백만원), 창고·고객=동(억동/백만동).

function UpdateBanner() {
  const { lang } = useLang();
  const updateReady = useVersionCheck();
  if (!updateReady) return null;
  return (
    <div className="bg-emerald-600 text-white">
      <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span className="font-medium">{localizeText('새 버전이 있습니다.', 'A new version is available.', lang)}</span>
        <button
          onClick={applyUpdate}
          className="ml-1 rounded-full bg-white text-emerald-700 font-bold px-3 py-1 text-xs hover:bg-emerald-50 transition-colors"
        >
          {localizeText('업데이트', 'Update', lang)}
        </button>
      </div>
    </div>
  );
}

export default function Layout({ currentPage, onNavigate, children }) {
  const { t, currency } = useLang();
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <UpdateBanner />
      {/* 상단 헤더 */}
      <header className="bg-blue-800 text-white shadow-lg sticky top-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart2 className="w-6 h-6 text-blue-200 shrink-0" />
            <span className="font-bold text-sm sm:text-lg tracking-tight truncate">{translateDisplay("대한통운 북부 대시보드")}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* 데스크톱 네비 */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors
                    ${currentPage === id ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-700'}`}
                >
                  <Icon className="w-4 h-4" />
                  {t(label)}
                </button>
              ))}
            </nav>
            <CurrencyToggle />
            <LangToggle />
          </div>
        </div>
      </header>
      {currency === 'krw' && <div className="bg-blue-50 text-blue-700 text-center px-3 py-1 text-[11px]">{translateDisplay("원화 환산 · 참고 환율 1 VND = 0.056원(고정, 실시간 아님) · 원본·분석 기준은 VND")}</div>}

      {/* 메인 */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 py-4 pb-24 md:pb-6">
        {children}
      </main>

      {/* 모바일 하단 탭바 */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors
                ${currentPage === id ? 'text-blue-700' : 'text-slate-400'}`}
            >
              <Icon className="w-5 h-5" />
              {t(label)}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
