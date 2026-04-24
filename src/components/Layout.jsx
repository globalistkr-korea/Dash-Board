import { useState } from 'react';
import { BarChart2, Users, Warehouse, Upload, Menu, X, TrendingUp } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'plan',      label: '경영계획',  icon: TrendingUp  },
  { id: 'customer',  label: '고객실적',  icon: Users       },
  { id: 'warehouse', label: '창고실적',  icon: Warehouse   },
  { id: 'upload',    label: '데이터 업로드', icon: Upload  },
];

export default function Layout({ currentPage, onNavigate, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* 상단 헤더 */}
      <header className="bg-blue-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-200" />
            <span className="font-bold text-lg tracking-tight">VN 경영 대시보드</span>
          </div>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${currentPage === id
                    ? 'bg-white text-blue-800'
                    : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* 모바일 햄버거 */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {menuOpen && (
          <div className="md:hidden bg-blue-900 px-4 pb-3 space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { onNavigate(id); setMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  ${currentPage === id
                    ? 'bg-white text-blue-800'
                    : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        VN Dashboard © 2026
      </footer>
    </div>
  );
}
