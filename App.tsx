
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Package, 
  CreditCard, 
  Wallet, 
  Users, 
  BarChart3,
  Cloud,
  Calculator,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { BENGALI_TEXT } from './constants';
import { DataService } from './services/dataService';
import { useData } from './hooks/useData';
import PurchaseModule from './components/PurchaseModule';
import SalesModule from './components/SalesModule';
import StockModule from './components/StockModule';
import ExpenseModule from './components/ExpenseModule';
import CashModule from './components/CashModule';
import DueModule from './components/DueModule';
import ReportModule from './components/ReportModule';
import DenominationModule from './components/DenominationModule';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('purchase');
  const { loading, user, syncKey, refresh } = useData();
  const [userName, setUserName] = useState('');
  const [syncId, setSyncId] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (user && syncKey) {
      setIsSetup(true);
    }
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, [user, syncKey]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() && syncId.trim()) {
      setIsSettingUp(true);
      setSetupError(null);
      try {
        await DataService.setupShop(userName, syncId);
        setIsSetup(true);
        refresh();
      } catch (error: any) {
        console.error("Failed to setup shop:", error);
        if (error.message.includes('fetch')) {
            setSetupError('সার্ভারের সাথে সংযোগ করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ এবং Supabase CORS পলিসি চেক করুন।');
        } else if (error.message.includes('security policy')) {
            setSetupError('নিরাপত্তা নীতির কারণে নতুন শপ তৈরি করা যাচ্ছে না। Supabase ড্যাশবোর্ডে "shops" টেবিলের জন্য একটি INSERT পলিসি যোগ করুন।');
        } else {
            setSetupError(`একটি অপ্রত্যাশিত সমস্যা হয়েছে: ${error.message}`);
        }
      } finally {
        setIsSettingUp(false);
      }
    }
  };

  if (!isSetup) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-green-100">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full">
              <Cloud className="w-10 h-10 text-green-600 animate-pulse-slow" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-green-800 mb-2">{BENGALI_TEXT.appName}</h1>
          <form onSubmit={handleSetup} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">আপনার নাম</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-green-500 transition-all"
                placeholder="নাম লিখুন"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{BENGALI_TEXT.syncKey}</label>
              <input
                type="text"
                value={syncId}
                onChange={(e) => setSyncId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-green-500 font-mono"
                placeholder="যেমন: shop123"
                required
              />
            </div>

            {setupError && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSettingUp}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSettingUp ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'একাউন্ট তৈরি করুন'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const menu = [
    { id: 'purchase', icon: ShoppingBag, label: 'কেনা' },
    { id: 'sales', icon: ShoppingCart, label: 'বেচা' },
    { id: 'stock', icon: Package, label: 'স্টক' },
    { id: 'expense', icon: CreditCard, label: 'খরচ' },
    { id: 'due', icon: Users, label: 'বাকি' },
    { id: 'cash', icon: Wallet, label: 'ক্যাশ' },
    { id: 'calc', icon: Calculator, label: 'ক্যালকুলেটর' },
    { id: 'reports', icon: BarChart3, label: 'রিপোর্ট' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 lg:pl-64">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 flex-col shadow-sm z-40">
        <div className="p-6 border-b bg-green-600 text-white shadow-inner">
          <h1 className="font-bold text-xl">{BENGALI_TEXT.appName}</h1>
          <p className="text-[10px] opacity-80 uppercase font-bold tracking-tighter mt-1">ID: {syncKey}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          {menu.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                activeTab === m.id ? 'bg-green-600 text-white shadow-lg scale-105 font-bold' : 'text-gray-500 hover:bg-green-50'
              }`}
            >
              <m.icon size={20} />
              <span>{m.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="p-4 lg:p-10 max-w-7xl mx-auto">
        <div className="lg:hidden flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
           <h1 className="font-bold text-green-700 text-lg">{BENGALI_TEXT.appName}</h1>
           <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'অনলাইন' : 'অফলাইন'} />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-green-600">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-bold">ডেটা লোড হচ্ছে...</p>
          </div>
        ) : (
          <>
            {activeTab === 'purchase' && <PurchaseModule />}
            {activeTab === 'sales' && <SalesModule />}
            {activeTab === 'stock' && <StockModule />}
            {activeTab === 'expense' && <ExpenseModule />}
            {activeTab === 'due' && <DueModule />}
            {activeTab === 'cash' && <CashModule />}
            {activeTab === 'calc' && <DenominationModule />}
            {activeTab === 'reports' && <ReportModule />}
          </>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md border border-gray-100 flex justify-around p-2 rounded-3xl shadow-2xl z-50">
        {menu.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveTab(m.id)}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === m.id ? 'text-green-600 bg-green-50 scale-105' : 'text-gray-400'}`}
          >
            <m.icon size={20} />
            <span className="text-[8px] mt-1 font-bold">{m.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
