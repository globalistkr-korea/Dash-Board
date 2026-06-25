import { useState } from 'react';
import { UnitProvider } from './context/UnitContext';
import { LangProvider } from './context/LangContext';
import Layout from './components/Layout';
import PlanPage from './pages/PlanPage';
import WarehousePage from './pages/WarehousePage';
import CustomerPage from './pages/CustomerPage';
import ContractPage from './pages/ContractPage';

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
      {render()}
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
