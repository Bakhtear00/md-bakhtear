import React, { useState, useMemo } from 'react';
import { 
  Calculator, RotateCcw, Banknote, Save, History, 
  Edit2, Trash2
} from 'lucide-react';
import { NOTES, getLocalDateString } from '../constants';
import { DataService } from '../services/dataService';
import { useData } from '../hooks/useData';
import { CashLog } from '../types';

const DenominationModule: React.FC = () => {
  const { cashLogs, refresh } = useData();
  const [counts, setCounts] = useState<{ [key: number]: string }>(
    Object.fromEntries(NOTES.map(n => [n, '']))
  );
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const systemBalance = useMemo(() => {
    const logBeingEdited = editingLogId ? cashLogs.find(log => log.id === editingLogId) : null;
    const baseBalance = cashLogs.reduce((sum, log) => {
      if (log.id === editingLogId) return sum;
      if (log.type === 'WITHDRAW') return sum - log.amount;
      return sum + log.amount;
    }, 0);
    
    if (logBeingEdited) {
        if(logBeingEdited.type === 'WITHDRAW') return baseBalance + logBeingEdited.amount;
        if(logBeingEdited.type === 'ADD') return baseBalance - logBeingEdited.amount;
    }

    return baseBalance;

  }, [cashLogs, editingLogId]);

  const physicalTotal = useMemo(() => {
    return NOTES.reduce((sum, note) => sum + (note * (Number(counts[note]) || 0)), 0);
  }, [counts]);

  const gap = physicalTotal - systemBalance;

  const historyList = useMemo(() => {
    return cashLogs.filter(log => log.denominations).slice().reverse();
  }, [cashLogs]);

  const handleClear = () => {
    if (window.confirm(editingLogId ? 'এডিট বাতিল করতে চান?' : 'ফর্মের সব লেখা মুছে ফেলতে চান?')) {
      setCounts(Object.fromEntries(NOTES.map(n => [n, ''])));
      setEditingLogId(null);
    }
  };

  const handleInputChange = (note: number, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setCounts({ ...counts, [note]: value });
    }
  };

  const handleSave = async () => {
    if (physicalTotal <= 0) {
      alert('অনুগ্রহ করে নোটের সংখ্যা লিখুন।');
      return;
    }
    const logDate = getLocalDateString();
    const logData = {
        type: gap >= 0 ? 'ADD' : 'WITHDRAW' as 'ADD' | 'WITHDRAW',
        amount: Math.abs(gap),
        date: logDate,
        note: gap === 0 ? 'ক্যাশ হিসাব মেলানো হয়েছে' : `ক্যাশ সমন্বয় (${gap > 0 ? 'বেশি' : 'কম'} ৳${Math.abs(gap).toLocaleString('bn-BD')})`,
        denominations: counts
    };

    try {
      if (editingLogId) {
          await DataService.updateCashLog(logData, editingLogId);
          alert('হিসাব সফলভাবে আপডেট হয়েছে!');
      } else {
          await DataService.addCashLog(logData);
          alert('ক্যাশ হিসাব সফলভাবে সেভ হয়েছে!');
      }
      
      setEditingLogId(null);
      setCounts(Object.fromEntries(NOTES.map(n => [n, ''])));
      refresh();
    } catch (error) {
      console.error("Failed to save denomination:", error);
    }
  };

  const handleEdit = (log: CashLog) => {
    if (log.denominations) {
        const initialCounts = Object.fromEntries(NOTES.map(n => [n, '']));
        const hydratedCounts = { ...initialCounts, ...log.denominations };
        setCounts(hydratedCounts);
        setEditingLogId(log.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleDelete = async (id: string) => {
      if (window.confirm('আপনি কি এই হিসাবটি মুছে ফেলতে নিশ্চিত?')) {
        try {
          await DataService.deleteCashLog(id);
          alert('হিসাব সফলভাবে মোছা হয়েছে!');
          if (editingLogId === id) {
              setCounts(Object.fromEntries(NOTES.map(n => [n, ''])));
              setEditingLogId(null);
          }
          refresh();
        } catch (error) {
          console.error("Failed to delete denomination log:", error);
        }
      }
  };


  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <InfoCard title="ক্যাশ এ আছে" description="এটি আপনার খাতার হিসাব বা সিস্টেম ব্যালেন্স দেখাবে।" amount={systemBalance} color="bg-blue-100 text-blue-800" />
          <InfoCard title="হিসাব করা টাকার পরিমান" description="এটি আপনি হাতে গুনে যে টাকার পরিমাণ ইনपुट দিয়েছেন, তা দেখাবে।" amount={physicalTotal} color="bg-emerald-100 text-emerald-800" />
          <GapCard title="পার্থক্য (কম/বেশি)" description="এই দুটি হিসাবের মধ্যে পার্থক্য দেখাবে।" gap={gap} />
        </div>

        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border-2 border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b pb-4">
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
              <Calculator className="w-7 h-7 text-indigo-600" />
              {editingLogId ? 'হিসাব সংশোধন' : 'নোট গণনা করুন'}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={handleClear} className="flex items-center gap-2 bg-gray-100 text-gray-600 font-bold px-4 py-2 rounded-xl text-xs active:scale-95">
                <RotateCcw size={14} /> {editingLogId ? 'বাতিল' : 'মুছুন'}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {NOTES.map(note => (
              <div key={note} className="bg-gray-50/70 p-3 rounded-xl border border-gray-200">
                <label className="text-sm font-black text-gray-700 flex items-center gap-2 mb-1.5">
                  <Banknote size={16} className="text-gray-400" /> ৳{note.toLocaleString('bn-BD')}
                </label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*"
                  value={counts[note]}
                  onChange={(e) => handleInputChange(note, e.target.value)}
                  className="w-full bg-white text-center font-black text-lg text-gray-900 py-2 rounded-lg border-2 border-gray-200 outline-none focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-8">
            <button onClick={handleSave} className={`flex-1 flex items-center justify-center gap-2 text-white py-4 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all ${editingLogId ? 'bg-orange-600' : 'bg-green-600'}`}>
              <Save size={20} /> {editingLogId ? 'আপডেট করুন' : 'হিসাব সেভ করুন'}
            </button>
            {editingLogId && (
                <button
                  onClick={() => handleDelete(editingLogId)}
                  className="bg-red-600 text-white py-4 px-5 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Trash2 size={20} /> মুছুন
                </button>
             )}
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border-2 border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" /> পূর্বের হিসাব তালিকা
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black">
                <th className="px-4 py-3 text-left">তারিখ</th>
                <th className="px-4 py-3 text-left">ফলাফল</th>
                <th className="px-4 py-3 text-right">গণনা করা টাকা</th>
                <th className="px-4 py-3 text-right">নোটের বিবরণ</th>
                <th className="px-4 py-3 text-center no-print">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyList.map(log => {
                const physical = Object.entries(log.denominations || {}).reduce((sum, [note, count]) => sum + (Number(note) * Number(count)), 0);

                return (
                  <tr key={log.id} className="text-sm hover:bg-gray-50/50">
                    <td className="px-4 py-4 font-bold text-gray-700 align-top">{new Date(log.date).toLocaleDateString('bn-BD')}</td>
                    <td className="px-4 py-4 font-bold text-gray-500 align-top">{log.note}</td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-indigo-700 align-top">৳{physical.toLocaleString('bn-BD')}</td>
                    <td className="px-4 py-4 text-right">
                        <div className="flex flex-wrap gap-1.5 justify-end max-w-[250px] ml-auto">
                          {NOTES.filter(note => Number((log.denominations || {})[note] || '0') > 0).map(note => {
                            const count = Number((log.denominations || {})[note] || '0');
                            return (
                              <div key={note} className="bg-gray-100 px-2 py-1 rounded-md text-xs">
                                <span className="font-bold text-gray-600">{note.toLocaleString('bn-BD')}</span>
                                <span className="font-black text-indigo-600"> x {count.toLocaleString('bn-BD')}</span>
                              </div>
                            );
                          })}
                        </div>
                    </td>
                    <td className="px-4 py-4 text-center no-print align-top">
                        <div className="flex items-center justify-center gap-2">
                           <button onClick={() => handleEdit(log)} className="p-2 bg-blue-50 text-blue-500 rounded-lg"><Edit2 size={16} /></button>
                           <button onClick={() => handleDelete(log.id)} className="p-2 bg-red-50 text-red-500 rounded-lg">
                             <Trash2 size={16} />
                           </button>
                        </div>
                    </td>
                  </tr>
                );
              })}
              {historyList.length === 0 && (
                 <tr><td colSpan={5} className="py-12 text-center text-gray-400 font-bold">কোনো হিসাব সেভ করা নেই।</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ title, description, amount, color }: { title: string, description: string, amount: number, color: string }) => (
  <div className={`p-6 rounded-[2rem] shadow-sm ${color}`}>
    <p className="text-sm font-black uppercase opacity-90">{title}</p>
    <p className="text-[11px] opacity-70 leading-tight mb-2">{description}</p>
    <p className="text-4xl font-black text-right">৳ {amount.toLocaleString('bn-BD')}</p>
  </div>
);

const GapCard = ({ title, description, gap }: { title: string, description: string, gap: number }) => {
  const isZero = gap === 0;
  const isPositive = gap > 0;
  const color = isZero ? 'bg-gray-100 text-gray-800' : isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  const text = isZero ? 'হিসাব মিলে গেছে' : isPositive ? `বেশি (+) ৳${gap.toLocaleString('bn-BD')}` : `কম (-) ৳${Math.abs(gap).toLocaleString('bn-BD')}`;

  return (
    <div className={`p-6 rounded-[2rem] shadow-sm ${color}`}>
      <p className="text-sm font-black uppercase">{title}</p>
      <p className="text-[11px] opacity-70 leading-tight mb-2">{description}</p>
      <p className="text-3xl font-black text-right">{text}</p>
    </div>
  );
};

export default DenominationModule;