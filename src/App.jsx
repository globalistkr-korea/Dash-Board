import { useState } from 'react';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import PlanPage from './pages/PlanPage';
import CustomerPage from './pages/CustomerPage';
import WarehousePage from './pages/WarehousePage';
import UploadPage from './pages/UploadPage';

function AppContent() {
  const [page, setPage] = useState('plan');

  const renderPage = () => {
    switch (page) {
      case 'plan':      return <PlanPage      onNavigate={setPage} />;
      case 'customer':  return <CustomerPage  onNavigate={setPage} />;
      case 'warehouse': return <WarehousePage onNavigate={setPage} />;
      case 'upload':    return <UploadPage />;
      default:          return <PlanPage      onNavigate={setPage} />;
    }
  };

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
