import { useState, useEffect, useCallback } from 'react';
import { DataService } from '../services/dataService';
import { Purchase, Sale, Expense, DueRecord, CashLog, LotArchive } from '../types';

interface AppData {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  dues: DueRecord[];
  cashLogs: CashLog[];
  stock: { [key: string]: { pieces: number; kg: number; dead: number; } };
  resets: { [key: string]: string };
  lotHistory: LotArchive[];
  user: string | null;
  syncKey: string | null;
}

export const useData = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppData>({
    purchases: [],
    sales: [],
    expenses: [],
    dues: [],
    cashLogs: [],
    stock: {},
    resets: {},
    lotHistory: [],
    user: DataService.getUser(),
    syncKey: DataService.getSyncKey(),
  });

  const fetchData = useCallback(async () => {
    if (!DataService.getSyncKey()) {
      setLoading(false);
      setData(prev => ({ ...prev, user: null, syncKey: null, purchases: [], sales: [], expenses: [], dues: [], cashLogs: [], stock: {}, lotHistory: [], resets: {} }));
      return;
    }

    setLoading(true);
    try {
      const [purchases, sales, expenses, dues, cashLogs, lotHistory] = await Promise.all([
        DataService.getPurchases(),
        DataService.getSales(),
        DataService.getExpenses(),
        DataService.getDues(),
        DataService.getCashLogs(),
        DataService.getLotHistory()
      ]);

      const stock = DataService.calculateStock(purchases, sales);
      const resets = DataService.getResets();
      
      setData({
        purchases,
        sales,
        expenses,
        dues,
        cashLogs,
        stock,
        resets,
        lotHistory,
        user: DataService.getUser(),
        syncKey: DataService.getSyncKey(),
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, loading, refresh: fetchData };
};
