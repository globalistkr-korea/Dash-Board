import { createContext, useContext, useState, useEffect } from 'react';
import { parsePlanFile, parseCustomerFile, parseWarehouseFile } from '../utils/excelParser';

const DataContext = createContext(null);

const STORAGE_KEY = 'vn_dashboard_data';

export function DataProvider({ children }) {
  const [planData, setPlanData]         = useState(null); // { 2023: {...}, 2024: {...}, ... }
  const [customerData, setCustomerData] = useState(null); // []
  const [warehouseData, setWarehouseData] = useState(null); // []
  const [uploadStatus, setUploadStatus] = useState({ plan: null, customer: null, warehouse: null });
  const [loading, setLoading] = useState(false);

  // localStorage에서 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { plan, customer, warehouse, status } = JSON.parse(saved);
        if (plan)      setPlanData(plan);
        if (customer)  setCustomerData(customer);
        if (warehouse) setWarehouseData(warehouse);
        if (status)    setUploadStatus(status);
      }
    } catch (e) {
      console.warn('로컬 데이터 로드 실패:', e);
    }
  }, []);

  const saveToStorage = (plan, customer, warehouse, status) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, customer, warehouse, status }));
    } catch (e) {
      console.warn('저장 실패 (용량 초과 가능):', e);
    }
  };

  const uploadFile = async (file, type) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const now = new Date().toLocaleDateString('ko-KR');

      if (type === 'plan') {
        const data = parsePlanFile(buffer);
        setPlanData(data);
        const newStatus = { ...uploadStatus, plan: { filename: file.name, date: now } };
        setUploadStatus(newStatus);
        saveToStorage(data, customerData, warehouseData, newStatus);
      } else if (type === 'customer') {
        const data = parseCustomerFile(buffer);
        setCustomerData(data);
        const newStatus = { ...uploadStatus, customer: { filename: file.name, date: now } };
        setUploadStatus(newStatus);
        saveToStorage(planData, data, warehouseData, newStatus);
      } else if (type === 'warehouse') {
        const data = parseWarehouseFile(buffer);
        setWarehouseData(data);
        const newStatus = { ...uploadStatus, warehouse: { filename: file.name, date: now } };
        setUploadStatus(newStatus);
        saveToStorage(planData, customerData, data, newStatus);
      }
    } catch (e) {
      console.error('파일 파싱 오류:', e);
      alert(`파일 처리 중 오류가 발생했습니다.\n${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DataContext.Provider value={{
      planData, customerData, warehouseData,
      uploadStatus, loading, uploadFile,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
