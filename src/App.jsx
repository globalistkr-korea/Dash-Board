import { translateDisplay } from "./lib/i18n";
import { lazy, Suspense, useState } from 'react';
import { LangProvider } from './context/LangContext';
import Layout from './components/Layout';
import PlanPage from './pages/PlanPage';
import { DecisionLinkProvider } from './context/DecisionLinkContext';

const DecisionPage = lazy(() => import('./pages/DecisionPage'));
const WarehousePage = lazy(() => import('./pages/WarehousePage'));
const CustomerPage = lazy(() => import('./pages/CustomerPage'));
const ContractPage = lazy(() => import('./pages/ContractPage'));

function PageLoading() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">{translateDisplay(" 분석 화면은 유지한 채 필요한 페이지를 불러오는 중입니다… ")}</div>
  );
}

function AppContent() {
  const [page, setPage] = useState(() => { const value=new URLSearchParams(window.location.search).get('page'); return ['plan','warehouse','customer','contract','decision'].includes(value)?value:'plan'; });
  const render = () => {
    switch (page) {
      case 'decision': return <DecisionPage />;
      case 'warehouse': return <WarehousePage />;
      case 'customer':  return <CustomerPage />;
      case 'contract':  return <ContractPage />;
      case 'plan':
      default:          return <PlanPage />;
    }
  };
  const navigate = value => {setPage(value);const url=new URL(window.location.href);url.searchParams.set('page',value);window.history.replaceState(null,'',url);};
  return (
    <DecisionLinkProvider onNavigate={navigate}>
    <Layout currentPage={page} onNavigate={navigate}>
      <Suspense fallback={<PageLoading />}>
        {render()}
      </Suspense>
    </Layout>
    </DecisionLinkProvider>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppContent />
    </LangProvider>
  );
}
