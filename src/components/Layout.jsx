import { BarChart2, Users, Warehouse, FileText, TrendingUp } from 'lucide-react';
import { useUnit } from '../context/UnitContext';
import { useLang } from '../context/LangContext';

const NAV_ITEMS = [
  { id: 'plan',      label: '경영계획',  icon: TrendingUp },
  { id: 'warehouse', label: '창고별',    icon: Warehouse  },
  { id: 'customer',  label: '고객사별',  icon: Users      },
  { id: 'contract',  label: '계약',      icon: FileText   },
];

function LangToggle() {
  const { lang, toggleLang } = useLang();
  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-700/60 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
      title="언어 전환 (한국어 ↔ English)"
    >
      <span className={lang === 'ko' ? 'text-white' : 'text-blue-300'}>한</span>
      <span className="text-blue-400">/</span>
      <span className={lang === 'en' ? 'text-white' : 'text-blue-300'}>EN</span>
    </button>
  );
}

function UnitToggle() {
  const { unit, toggleUnit } = useUnit();
  return (
    <button
      onClick={toggleUnit}
      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-700/60 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
      title="단위 전환 (백만동 ↔ 백만원)"
    >
      <span className={unit === 'vnd' ? 'text-white' : 'text-blue-300'}>백만동</span>
      <span className="text-blue-400">/</span>
      <span className={unit === 'krw' ? 'text-white' : 'text-blue-300'}>백만원</span>
    </button>
  );
}

export default function Layout({ currentPage, onNavigate, children }) {
  const { t } = useLang();
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* 상단 헤더 */}
      <header className="bg-blue-800 text-white shadow-lg sticky top-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-200" />
            <span className="font-bold text-base sm:text-lg tracking-tight">대한통운 북부 대시보드</span>
          </div>

          <div className="flex items-center gap-3">
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
            <LangToggle />
            <UnitToggle />
          </div>
        </div>
      </header>

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
