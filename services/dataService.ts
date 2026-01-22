import { supabase } from './supabaseClient';
import { Purchase, Sale, DueRecord, Expense, CashLog, LotArchive } from '../types';
import { getLocalDateString } from '../constants';
import { POULTRY_TYPES } from '../constants';

const SHOP_KEY = 'p_shop_key';
const USER_KEY = 'p_shop_user';
const RESETS_KEY = 'p_shop_resets'; // লট রিসেটের সময় লোকাল স্টোরেজে রাখা হবে

const getShopId = () => localStorage.getItem(SHOP_KEY);
const getResets = () => JSON.parse(localStorage.getItem(RESETS_KEY) || '{}');
const setResets = (data: any) => localStorage.setItem(RESETS_KEY, JSON.stringify(data));

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, context: string) => {
  if (error) {
    console.error(`Supabase error in ${context}:`, error);
    let userMessage = `একটি সমস্যা হয়েছে (${context}): ${error.message}`;

    if (error.message && error.message.includes('violates row-level security policy')) {
      const match = error.message.match(/for table "([^"]+)"/);
      const tableName = match ? match[1] : 'একটি টেবিলে';
      
      const operationMatch = context.match(/Add|Update|Delete/);
      const operation = operationMatch ? operationMatch[0].toUpperCase() : 'INSERT/UPDATE/DELETE';

      userMessage = `ডেটাবেস নিরাপত্তা (${tableName}) পলিসির কারণে তথ্য সেভ করা যাচ্ছে না। \n\nসমাধান: Supabase ড্যাশবোর্ডে গিয়ে '${tableName}' টেবিলের জন্য একটি নতুন ${operation} পলিসি তৈরি করুন। \n\n"Authentication" > "Policies" এ যান এবং "${tableName}" টেবিলের জন্য "Enable ${operation.toLowerCase()} access for everyone" টেমপ্লেটটি ব্যবহার করুন অথবা একটি কাস্টম পলিসি তৈরি করুন।`;
    } else {
      userMessage += '\n\n(টিপ: আপনার ইন্টারনেট সংযোগ এবং Supabase API কী ঠিক আছে কিনা তা চেক করুন।)';
    }
    
    alert(userMessage);
    throw new Error(error.message);
  }
};


const saveLotAndReset = async (type: string): Promise<boolean> => {
    const shopId = getShopId();
    if (!shopId) return false;

    const resets = getResets();
    const lastSaveTime = resets[type] ? new Date(resets[type]).toISOString() : new Date(0).toISOString();

    const { data: purchases, error: pError } = await supabase.from('purchases').select('*').eq('shop_id', shopId).eq('type', type).gt('created_at', lastSaveTime);
    if (pError) { console.error(pError); return false; }

    const { data: sales, error: sError } = await supabase.from('sales').select('*').eq('shop_id', shopId).eq('type', type).gt('created_at', lastSaveTime);
    if (sError) { console.error(sError); return false; }

    const totalBuy = purchases.reduce((sum: number, p: Purchase) => sum + p.total, 0);
    const totalSell = sales.reduce((sum: number, s: Sale) => sum + s.total, 0);

    if (totalBuy === 0 && totalSell === 0) return false;

    const newHistoryEntry = {
        type: type,
        total_purchase: totalBuy,
        total_sale: totalSell,
        profit: totalSell - totalBuy,
        date: new Date().toISOString(),
        shop_id: shopId
    };

    const { error: insertError } = await supabase.from('lot_archives').insert([newHistoryEntry]);
    if (insertError) { console.error(insertError); return false; }
    
    setResets({ ...resets, [type]: new Date().toISOString() });
    return true;
};

const checkAndTriggerAutoSave = async (type: string) => {
    const shopId = getShopId();
    if (!shopId) return;

    const resets = getResets();
    const lastSaveTime = resets[type] ? new Date(resets[type]).toISOString() : new Date(0).toISOString();

    const { data: lotPurchases, error: pError } = await supabase.from('purchases').select('pieces').eq('shop_id', shopId).eq('type', type).gt('created_at', lastSaveTime);
    if (pError) return;
    const totalPurchasePieces = lotPurchases.reduce((sum, p) => sum + (Number(p.pieces) || 0), 0);
  
    const { data: lotSales, error: sError } = await supabase.from('sales').select('pieces,mortality').eq('shop_id', shopId).eq('type', type).gt('created_at', lastSaveTime);
    if (sError) return;
    const totalSaleAndDeadPieces = lotSales.reduce((sum, s) => sum + (Number(s.pieces) || 0) + (Number(s.mortality) || 0), 0);
    
    if ((totalPurchasePieces - totalSaleAndDeadPieces) <= 0 && totalPurchasePieces > 0) {
        if (await saveLotAndReset(type)) {
            alert(`${type} -এর স্টক শেষ হওয়ায় লটের হিসাবটি স্বয়ংক্রিয়ভাবে সেভ হয়েছে।`);
        }
    }
};

export const DataService = {
  // Setup
  getUser: () => localStorage.getItem(USER_KEY),
  getSyncKey: () => localStorage.getItem(SHOP_KEY),
  setupShop: async (name: string, key: string) => {
    localStorage.setItem(USER_KEY, name);
    localStorage.setItem(SHOP_KEY, key);
    localStorage.removeItem(RESETS_KEY);
    const { data, error } = await supabase.from('shops').select('id').eq('id', key).single();
    if (error && error.code !== 'PGRST116') handleSupabaseError(error, 'Shop Setup');
    if (!data) {
        const { error: insertError } = await supabase.from('shops').insert([{ id: key, owner_name: name }]);
        handleSupabaseError(insertError, 'Shop Create');
    }
  },
  
  // Purchases
  getPurchases: async (): Promise<Purchase[]> => (await supabase.from('purchases').select('*').eq('shop_id', getShopId()).order('date', { ascending: false })).data || [],
  addPurchase: async (p: Omit<Purchase, 'id'>) => {
    const { error } = await supabase.from('purchases').insert([{ ...p, shop_id: getShopId() }]);
    handleSupabaseError(error, 'Add Purchase');
  },
  updatePurchase: async (purchase: Omit<Purchase, 'id'>, id: string) => {
    const { data: oldDataArr, error: selectError } = await supabase.from('purchases').select('*').eq('id', id);
    handleSupabaseError(selectError, 'Update Purchase (Select)');
    if (!oldDataArr || oldDataArr.length === 0) return;
    
    const { error: updateError } = await supabase.from('purchases').update(purchase).eq('id', id);
    handleSupabaseError(updateError, 'Update Purchase');
    
    const oldPurchase = oldDataArr[0];
    const wasCredit = oldPurchase.is_credit || false;
    const isCredit = purchase.is_credit || false;
    if (!wasCredit && !isCredit) {
        const difference = purchase.total - oldPurchase.total;
        if (difference !== 0) await DataService.addCashLog({ type: difference > 0 ? 'WITHDRAW' : 'ADD', amount: Math.abs(difference), date: getLocalDateString(), note: `ক্রয় সংশোধন: ${purchase.type}` });
    } else if (wasCredit && !isCredit) {
        await DataService.addCashLog({ type: 'WITHDRAW', amount: purchase.total, date: getLocalDateString(), note: `বাকি ক্রয় নগদে সংশোধন: ${purchase.type}` });
    } else if (!wasCredit && isCredit) {
        await DataService.addCashLog({ type: 'ADD', amount: oldPurchase.total, date: getLocalDateString(), note: `নগদ ক্রয় বাকিতে সংশোধন: ${purchase.type}` });
    }
    await checkAndTriggerAutoSave(purchase.type);
    if (oldPurchase.type !== purchase.type) await checkAndTriggerAutoSave(oldPurchase.type);
  },
  deletePurchase: async (id: string) => {
    const { data, error } = await supabase.from('purchases').select('*').eq('id', id);
    handleSupabaseError(error, 'Delete Purchase (Select)');
    if (!data || data.length === 0) return;
    
    const purchaseToDelete = data[0];
    const { error: deleteError } = await supabase.from('purchases').delete().eq('id', id);
    handleSupabaseError(deleteError, 'Delete Purchase');

    if (!purchaseToDelete.is_credit) {
      await DataService.addCashLog({ type: 'ADD', amount: purchaseToDelete.total, date: getLocalDateString(), note: `ক্রয় মুছে ফেলায় টাকা ফেরত: ${purchaseToDelete.type}` });
    }
    await checkAndTriggerAutoSave(purchaseToDelete.type);
  },
  
  // Sales
  getSales: async (): Promise<Sale[]> => (await supabase.from('sales').select('*').eq('shop_id', getShopId()).order('date', { ascending: false })).data || [],
  addSale: async (s: Omit<Sale, 'id'>) => {
    const { error } = await supabase.from('sales').insert([{ ...s, shop_id: getShopId() }]);
    handleSupabaseError(error, 'Add Sale');
    await checkAndTriggerAutoSave(s.type);
  },
  updateSale: async (sale: Omit<Sale, 'id'>, id: string) => {
    const { data, error } = await supabase.from('sales').select('*').eq('id', id);
    handleSupabaseError(error, 'Update Sale (Select)');
    if (!data || data.length === 0) return;

    const oldSale = data[0];
    const { error: updateError } = await supabase.from('sales').update(sale).eq('id', id);
    handleSupabaseError(updateError, 'Update Sale');

    const difference = sale.total - oldSale.total;
    if (difference !== 0) {
        await DataService.addCashLog({ type: difference > 0 ? 'ADD' : 'WITHDRAW', amount: Math.abs(difference), date: getLocalDateString(), note: `বিক্রয় সংশোধন: ${sale.type}` });
    }
    await checkAndTriggerAutoSave(sale.type);
    if (oldSale.type !== sale.type) await checkAndTriggerAutoSave(oldSale.type);
  },
  deleteSale: async (id: string) => {
    const { data, error } = await supabase.from('sales').select('*').eq('id', id);
    handleSupabaseError(error, 'Delete Sale (Select)');
    if (!data || data.length === 0) return;

    const saleToDelete = data[0];
    const { error: deleteError } = await supabase.from('sales').delete().eq('id', id);
    handleSupabaseError(deleteError, 'Delete Sale');

    await DataService.addCashLog({ type: 'WITHDRAW', amount: saleToDelete.total, date: getLocalDateString(), note: `বিক্রয় মুছে ফেলা হয়েছে: ${saleToDelete.type}` });
    await checkAndTriggerAutoSave(saleToDelete.type);
  },
  
  // Expenses
  getExpenses: async (): Promise<Expense[]> => (await supabase.from('expenses').select('*').eq('shop_id', getShopId()).order('date', { ascending: false })).data || [],
  addExpense: async (e: Omit<Expense, 'id'>) => {
    const { error } = await supabase.from('expenses').insert([{ ...e, shop_id: getShopId() }]);
    handleSupabaseError(error, 'Add Expense');
  },
  updateExpense: async (expense: Omit<Expense, 'id'>, id: string) => {
    const { data, error } = await supabase.from('expenses').select('*').eq('id', id);
    handleSupabaseError(error, 'Update Expense (Select)');
    if (!data || data.length === 0) return;

    const oldExpense = data[0];
    const { error: updateError } = await supabase.from('expenses').update(expense).eq('id', id);
    handleSupabaseError(updateError, 'Update Expense');

    const difference = expense.amount - oldExpense.amount;
    if (difference !== 0) {
      await DataService.addCashLog({ type: difference > 0 ? 'WITHDRAW' : 'ADD', amount: Math.abs(difference), date: getLocalDateString(), note: `খরচ সংশোধন: ${expense.category}` });
    }
  },
  deleteExpense: async (id: string) => {
    const { data, error } = await supabase.from('expenses').select('*').eq('id', id);
    handleSupabaseError(error, 'Delete Expense (Select)');
    if (!data || data.length === 0) return;

    const expenseToDelete = data[0];
    const { error: deleteError } = await supabase.from('expenses').delete().eq('id', id);
    handleSupabaseError(deleteError, 'Delete Expense');
    
    await DataService.addCashLog({ type: 'ADD', amount: expenseToDelete.amount, date: getLocalDateString(), note: `খরচ মুছে ফেলা হয়েছে: ${expenseToDelete.category}` });
  },
  
  // Dues
  getDues: async (): Promise<DueRecord[]> => (await supabase.from('dues').select('*').eq('shop_id', getShopId()).order('date', { ascending: false })).data || [],
  addDue: async (d: Omit<DueRecord, 'id'>) => {
    const { error } = await supabase.from('dues').insert([{ ...d, shop_id: getShopId() }]);
    handleSupabaseError(error, 'Add Due');
  },
  updateDue: async (d: Partial<DueRecord>, id: string) => {
    const { error } = await supabase.from('dues').update(d).eq('id', id);
    handleSupabaseError(error, 'Update Due');
  },
  deleteDue: async (id: string) => {
    const { data, error } = await supabase.from('dues').select('*').eq('id', id);
    handleSupabaseError(error, 'Delete Due (Select)');
    if (!data || data.length === 0) return;
    
    const dueToDelete = data[0];
    const { error: deleteError } = await supabase.from('dues').delete().eq('id', id);
    handleSupabaseError(deleteError, 'Delete Due');

    const remainingDue = dueToDelete.amount - (dueToDelete.paid || 0);
    if (remainingDue > 0) {
      await DataService.addCashLog({ type: 'ADD', amount: remainingDue, date: getLocalDateString(), note: `বাকি হিসাব মুছে ফেলায় টাকা ফেরত: ${dueToDelete.customer_name}` });
    }
  },

  // Cash Logs
  getCashLogs: async (): Promise<CashLog[]> => (await supabase.from('cash_logs').select('*').eq('shop_id', getShopId()).order('created_at', { ascending: false })).data || [],
  addCashLog: async (c: Omit<CashLog, 'id'>) => {
    const { error } = await supabase.from('cash_logs').insert([{ ...c, shop_id: getShopId() }]);
    handleSupabaseError(error, 'Add Cash Log');
  },
  updateCashLog: async (c: Omit<CashLog, 'id'>, id: string) => {
    const { error } = await supabase.from('cash_logs').update(c).eq('id', id);
    handleSupabaseError(error, 'Update Cash Log');
  },
  deleteCashLog: async (id: string) => {
    const { error } = await supabase.from('cash_logs').delete().eq('id', id);
    handleSupabaseError(error, 'Delete Cash Log');
  },

  // Lot History
  getLotHistory: async (): Promise<LotArchive[]> => (await supabase.from('lot_archives').select('*').eq('shop_id', getShopId()).order('date', { ascending: false })).data || [],
  
  // Analytics Helper
  getResets: () => getResets(),
  calculateStock: (purchases: Purchase[], sales: Sale[]) => {
    const stockByType: { [key: string]: { pieces: number; kg: number; dead: number; } } = {};
    POULTRY_TYPES.forEach(type => stockByType[type] = { pieces: 0, kg: 0, dead: 0 });
    purchases.forEach(p => {
      stockByType[p.type].pieces += Number(p.pieces) || 0;
      stockByType[p.type].kg += Number(p.kg) || 0;
    });
    sales.forEach(s => {
      stockByType[s.type].pieces -= (Number(s.pieces) || 0) + (Number(s.mortality) || 0);
      stockByType[s.type].dead += Number(s.mortality) || 0;
    });
    return stockByType;
  }
};