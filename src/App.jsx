import { lazy, Suspense, useState } from 'react';
import { UnitProvider } from './context/UnitContext';
import { LangProvider } from './context/LangContext';
import Layout from './components/Layout';
import PlanPage from './pages/PlanPage';

const WarehousePage = lazy(() => import('./pages/WarehousePage'));
const CustomerPage = lazy(() => import('./pages/CustomerPage'));
const ContractPage = lazy(() => import('./pages/ContractPage'));

function PageLoading() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
      분석 화면은 유지한 채 필요한 페이지를 불러오는 중입니다…
    </div>
  );
}

function AppContent() {
  const [page, setPage] = useState('plan');
  const render = () => {
    switch (page) {
      case 'warehouse': return <WarehousePage />;
      case 'customer':  return <CustomerPage />;
      case 'contract':  return <ContractPage />;
      case 'plan':
      default:          return <PlanPage />;
    }
  };
  return (
    <Layout currentPage={page} onNavigate={setPage}>
      <Suspense fallback={<PageLoading />}>
        {render()}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <LangProvider>
      <UnitProvider>
        <AppContent />
      </UnitProvider>
    </LangProvider>
  );
}
