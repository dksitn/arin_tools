'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { subscriptionTemplates } from '@/data/subscriptionTemplates';
import { Trash2, Plus, CreditCard, Calendar, Pencil, X, Save, LayoutList, Table2, Wallet, ArrowRight, TrendingUp, TrendingDown, PieChart, Layers, DollarSign, ChevronLeft, ChevronRight, RefreshCw, Home, AlertCircle, Link as LinkIcon, User, Calculator } from 'lucide-react';
import AuthButton from '@/components/AuthButton';

// --- Types ---
interface Subscription {
  id: string;
  name: string;
  price_twd: number;
  billing_cycle: 'monthly' | 'yearly';
  category: string;
  status: string;
  start_date: string;
  duration_months: number | null;
  payment_method_id: string | null;
  linked_account_id: string | null;
  record_type: 'income' | 'expense';
  user_payment_methods?: { bank_name: string; last_4_digits: string };
  user_accounts?: { account_email: string };
}

interface FinanceRecord {
  id: string;
  record_type: 'income' | 'expense';
  title: string;
  amount: number;
  category: string;
  transaction_date: string;
  isVirtual?: boolean;
  source_sub_id?: string;
}

// [Config] 收入類型設定
const INCOME_TYPES = [
  { id: 'salary', label: '固定月薪 (週期性)', isRecurring: true, category: '薪資' },
  { id: 'bonus', label: '單次獎金', isRecurring: false, category: '獎金' },
  { id: 'advance', label: '預收 (預設下月)', isRecurring: false, category: '預收' },
  { id: 'freelance', label: '接案', isRecurring: false, category: '接案' },
  { id: 'windfall', label: '意外之財', isRecurring: false, category: '其他' },
  { id: 'other', label: '其他 (請說明)', isRecurring: false, category: '其他' },
];

// [Config] 支出分類設定
const EXPENSE_CATEGORIES = [
  { id: 'food', label: '餐飲食品' },
  { id: 'traffic', label: '交通通勤' },
  { id: 'shopping', label: '購物消費' },
  { id: 'entertainment', label: '休閒娛樂' },
  { id: 'bills', label: '生活帳單 (水電瓦斯)' },
  { id: 'housing', label: '房租/房貸' },
  { id: 'medical', label: '醫療保健' },
  { id: 'other', label: '其他 (請說明)' },
];

export default function SubscriptionKernel({ config }: { config: any }) {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [records, setRecords] = useState<FinanceRecord[]>([]);

  const activeTab = config?.defaultTab || 'overview'; 
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(config?.defaultTab === 'overview' ? 'grid' : 'list');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [formSub, setFormSub] = useState<Subscription | null>(null);
  
  // UI Helper States
  const [inputTypeId, setInputTypeId] = useState<string>(''); 
  const [customNote, setCustomNote] = useState(''); 
  const [isRecurringIncome, setIsRecurringIncome] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'full' | 'installment'>('full');
  const [installments, setInstallments] = useState<number>(6);
  const [interestRate, setInterestRate] = useState<number>(0);
  const [calculatedMonthlyPay, setCalculatedMonthlyPay] = useState<number>(0);

  // Data Store
  const [isCustomNameMode, setIsCustomNameMode] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]); 
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [isAddingCardMode, setIsAddingCardMode] = useState(false);
  const [isAddingAccountMode, setIsAddingAccountMode] = useState(false);
  const [newCardData, setNewCardData] = useState({ bank_name: '', last_4_digits: '' });
  const [newAccountData, setNewAccountData] = useState({ account_email: '' });

  const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) await reloadAllData();
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED') {
        setUser(session?.user); reloadAllData();
      } else if (evt === 'SIGNED_OUT') {
        setUser(null); setSubscriptions([]); setRecords([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // 自動計算分期金額
  useEffect(() => {
    if (isRecordModalOpen && editingRecord && paymentMode === 'installment') {
      const total = editingRecord.amount || 0;
      const months = installments || 1;
      const rate = interestRate || 0;
      if (total > 0) {
        let monthly = 0;
        if (rate === 0) monthly = Math.ceil(total / months);
        else {
          const monthlyRate = rate / 100 / 12;
          monthly = Math.ceil((total * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
        }
        setCalculatedMonthlyPay(monthly);
      } else {
        setCalculatedMonthlyPay(0);
      }
    }
  }, [editingRecord?.amount, installments, interestRate, paymentMode, isRecordModalOpen]);

  async function reloadAllData() {
    setLoading(true);
    await Promise.all([fetchSubs(), fetchRecords(), fetchCards(), fetchAccounts()]);
    setLoading(false);
  }

  async function fetchSubs() {
    const { data } = await supabase.from('user_subscriptions').select('*, user_payment_methods(*), user_accounts(*)').eq('status', 'active');
    if (data) setSubscriptions(data);
  }

  async function fetchRecords() {
    const { data } = await supabase.from('user_finance_records').select('*').order('transaction_date', { ascending: false });
    if (data) setRecords(data);
  }

  async function fetchCards() {
    const { data } = await supabase.from('user_payment_methods').select('*');
    if (data) setPaymentMethods(data);
  }

  async function fetchAccounts() {
    const { data } = await supabase.from('user_accounts').select('*');
    if (data) setUserAccounts(data);
  }

  function handleTabChange(tab: string) {
    const tabMap: Record<string, string> = {
      'overview': 'finance-overview',
      'income': 'income-manager',
      'expense': 'expense-manager',
      'subscription': 'subscription-tracker'
    };
    router.push(`/tool/${tabMap[tab]}`);
  }

  // --- Logic Helpers ---
  function getSubCostForMonth(sub: Subscription, year: number, month: number): number {
    const targetDate = new Date(year, month - 1, 1);
    const subStart = new Date(sub.start_date);
    const subStartMonth = new Date(subStart.getFullYear(), subStart.getMonth(), 1);

    if (targetDate < subStartMonth) return 0;
    if (sub.duration_months) {
      const subEnd = new Date(subStart);
      subEnd.setMonth(subEnd.getMonth() + sub.duration_months);
      if (targetDate >= subEnd) return 0;
    }
    if (sub.billing_cycle === 'yearly') {
      return subStart.getMonth() === (month - 1) ? sub.price_twd : 0;
    }
    return sub.price_twd;
  }

  function calculateEndDate(startDate: string, duration: number | null): string {
    if (!duration) return '無限期';
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + duration);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  // --- Data Processing Strategy ---
  
  const currentYearRecords = records.filter(r => new Date(r.transaction_date).getFullYear() === selectedYear);
  
  // 訂閱與分期展開 (Virtual Records)
  const subscriptionYearlyRecords: FinanceRecord[] = [];
  subscriptions.forEach(s => {
    for (let m = 1; m <= 12; m++) {
      const amount = getSubCostForMonth(s, selectedYear, m);
      if (amount > 0) {
        let prefix = s.record_type === 'income' ? '[月薪]' : '[訂閱]';
        if (s.record_type === 'expense' && s.duration_months) prefix = '[分期]';
        if (s.record_type === 'expense' && ['bills', 'housing'].includes(s.category)) prefix = '[帳單]';

        subscriptionYearlyRecords.push({
          id: `sub_virtual_${s.id}_${m}`,
          record_type: s.record_type,
          title: `${prefix} ${s.name}`,
          amount: amount,
          category: s.category || (s.record_type === 'income' ? '固定收入' : '固定支出'),
          transaction_date: `${selectedYear}-${String(m).padStart(2, '0')}-${new Date(s.start_date).getDate()}`,
          isVirtual: true,
          source_sub_id: s.id
        });
      }
    }
  });

  // 顯示列表 (List View)
  const expenseDisplayList = [
    ...currentYearRecords.filter(r => r.record_type === 'expense'),
    ...subscriptionYearlyRecords.filter(r => r.record_type === 'expense')
  ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

  const incomeDisplayList = [
    ...currentYearRecords.filter(r => r.record_type === 'income'),
    ...subscriptionYearlyRecords.filter(r => r.record_type === 'income')
  ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

  const totalYearIncome = incomeDisplayList.reduce((sum, r) => sum + r.amount, 0);
  const totalYearExpense = expenseDisplayList.reduce((sum, r) => sum + r.amount, 0);
  const netYearBalance = totalYearIncome - totalYearExpense;

  // [Filter] 純訂閱過濾器
  // 條件：支出型 + 無期限 + 非帳單非房租 + 非分期付款類別
  // 修正：確保 name 不含 "期)" 的也過濾
  const pureSubscriptions = subscriptions.filter(s => 
    s.record_type === 'expense' && 
    !s.duration_months && 
    !['bills', 'housing', '分期付款'].includes(s.category) &&
    !s.name.includes('期)')
  );

  // Grid Aggregation Logic
  const getAggregatedRows = (type: 'income' | 'expense' | 'subscription') => {
    const rows: { id: string, title: string, isVirtual?: boolean, monthlyAmounts: number[], original?: any }[] = [];

    // A. 訂閱管理 Tab
    if (type === 'subscription') {
      pureSubscriptions.forEach(s => {
        const monthlyAmounts = Array.from({ length: 12 }, (_, i) => getSubCostForMonth(s, selectedYear, i + 1));
        rows.push({ id: s.id, title: s.name, isVirtual: false, monthlyAmounts, original: s });
      });
      return rows;
    }

    // B. 收入/費用 Tab (聚合所有週期性)
    const targetSubs = type === 'income' 
      ? subscriptions.filter(s => s.record_type === 'income') 
      : subscriptions.filter(s => s.record_type === 'expense');

    targetSubs.forEach(s => {
      let hasCost = false;
      const monthlyAmounts = Array.from({ length: 12 }, (_, i) => {
        const amt = getSubCostForMonth(s, selectedYear, i + 1);
        if (amt > 0) hasCost = true;
        return amt;
      });

      if (hasCost) {
        let prefix = type === 'income' ? '[月薪]' : '[訂閱]';
        if (type === 'expense' && s.duration_months) prefix = '[分期]';
        if (type === 'expense' && ['bills', 'housing'].includes(s.category)) prefix = '[帳單]';
        
        rows.push({
          id: `overview_sub_${s.id}`,
          title: `${prefix} ${s.name}`,
          isVirtual: true,
          monthlyAmounts,
          original: s
        });
      }
    });

    // C. 手動紀錄聚合
    const manualRecords = currentYearRecords.filter(r => r.record_type === type);
    const groupedMap = new Map<string, {id: string, title: string, monthlyAmounts: number[], original: any}>();

    manualRecords.forEach(r => {
      const monthIdx = new Date(r.transaction_date).getMonth();
      const key = r.title; 
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { id: r.id, title: r.title, monthlyAmounts: new Array(12).fill(0), original: r });
      }
      groupedMap.get(key)!.monthlyAmounts[monthIdx] += r.amount;
    });

    groupedMap.forEach(item => rows.push(item));
    return rows;
  };

  const overviewRows = [
    ...getAggregatedRows('income'),
    ...getAggregatedRows('expense') 
  ];

  const getGridColumnTotal = (monthIndex: number, type: 'income' | 'expense' | 'net') => {
    if (type === 'net') {
      const inc = getAggregatedRows('income').reduce((sum, row) => sum + row.monthlyAmounts[monthIndex], 0);
      const exp = getAggregatedRows('expense').reduce((sum, row) => sum + row.monthlyAmounts[monthIndex], 0);
      return inc - exp;
    }
    if (activeTab === 'subscription') {
       return pureSubscriptions.reduce((sum, s) => sum + getSubCostForMonth(s, selectedYear, monthIndex + 1), 0);
    }
    const rows = getAggregatedRows(type as 'income' | 'expense');
    return rows.reduce((sum, row) => sum + row.monthlyAmounts[monthIndex], 0);
  };

  const getCurrentTabTotal = () => {
    if (activeTab === 'income') return totalYearIncome;
    if (activeTab === 'expense') return totalYearExpense;
    // [FIX] 訂閱頁面 KPI 只算純訂閱
    if (activeTab === 'subscription') return pureSubscriptions.reduce((sum, s) => sum + (s.billing_cycle === 'yearly' ? Math.round(s.price_twd/12) : s.price_twd), 0);
    return 0;
  };

  const getTabLabel = () => {
    if (activeTab === 'income') return `${selectedYear}年 總收入`;
    if (activeTab === 'expense') return `${selectedYear}年 總支出`;
    if (activeTab === 'subscription') return `純訂閱支出 (平均月)`;
    return '';
  };

  const getTabIcon = () => {
    if (activeTab === 'income') return <TrendingUp size={32} className="text-green-600" />;
    if (activeTab === 'expense') return <TrendingDown size={32} className="text-orange-600" />;
    return <Wallet size={32} className="text-blue-600" />;
  };

  // --- Handlers ---
  function handleAddClick(tab: 'income' | 'expense') {
    setEditingRecord({ id: 'new', record_type: tab, title: '', amount: 0, category: '', transaction_date: new Date().toISOString().split('T')[0] });
    
    // [FIX] 預設選擇第一個選項，避免 inputTypeId 空值
    if (tab === 'income') {
        setInputTypeId('bonus');
        setIsRecurringIncome(false);
        setEditingRecord(prev => prev ? ({...prev, category: '獎金'}) : null);
    } else {
        setInputTypeId('food'); 
        setEditingRecord(prev => prev ? ({...prev, category: '餐飲食品'}) : null);
    }
    
    setCustomNote('');
    setPaymentMode('full');
    setInstallments(6);
    setInterestRate(0);
    setCalculatedMonthlyPay(0);
    setIsRecordModalOpen(true);
  }

  function handleInputTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const typeId = e.target.value;
    setInputTypeId(typeId);
    
    if (activeTab === 'income') {
      const typeConfig = INCOME_TYPES.find(t => t.id === typeId);
      if (typeConfig && editingRecord) {
        setIsRecurringIncome(typeConfig.isRecurring);
        setEditingRecord({ ...editingRecord, category: typeConfig.category }); 
        
        if (typeId === 'advance') {
          const today = new Date();
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          const dateStr = nextMonth.toISOString().split('T')[0];
          setEditingRecord(prev => prev ? ({ ...prev, transaction_date: dateStr }) : null);
        } else {
           const today = new Date().toISOString().split('T')[0];
           setEditingRecord(prev => prev ? ({ ...prev, transaction_date: today }) : null);
        }
      }
    } else {
      const typeConfig = EXPENSE_CATEGORIES.find(t => t.id === typeId);
      if (typeConfig && editingRecord) {
        setEditingRecord({ ...editingRecord, category: typeConfig.label });
      }
    }
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecord || !user) return;

    let finalTitle = '';
    if (inputTypeId === 'other') {
        finalTitle = customNote;
    } else {
        if (activeTab === 'income') finalTitle = INCOME_TYPES.find(t => t.id === inputTypeId)?.label || editingRecord.title;
        else finalTitle = EXPENSE_CATEGORIES.find(t => t.id === inputTypeId)?.label || editingRecord.title;
    }
    finalTitle = finalTitle.split(' (')[0];
    if (customNote) finalTitle = customNote;

    if ((activeTab === 'expense' && paymentMode === 'installment') || (activeTab === 'income' && isRecurringIncome)) {
        const isIncome = activeTab === 'income';
        const payload = {
            user_id: user.id,
            name: finalTitle + (isIncome ? '' : ` (${installments}期)`),
            price_twd: isIncome ? editingRecord.amount : calculatedMonthlyPay,
            billing_cycle: 'monthly',
            category: editingRecord.category || (isIncome ? '固定收入' : '分期付款'),
            start_date: editingRecord.transaction_date,
            duration_months: isIncome ? null : installments,
            record_type: activeTab,
            status: 'active'
        };
        await supabase.from('user_subscriptions').insert(payload);
    } else {
        const payload = {
          user_id: user.id, 
          record_type: editingRecord.record_type, 
          title: finalTitle, 
          amount: editingRecord.amount, 
          category: editingRecord.category, 
          transaction_date: editingRecord.transaction_date
        };
        if (editingRecord.id === 'new') await supabase.from('user_finance_records').insert(payload);
        else await supabase.from('user_finance_records').update(payload).eq('id', editingRecord.id);
    }

    setEditingRecord(null); 
    setIsRecordModalOpen(false); 
    fetchRecords(); 
    fetchSubs();
  }

  async function deleteRecord(id: string, isVirtual: boolean = false, originalSubId?: string) {
    if (!confirm('確定刪除？' + (isVirtual ? ' (這將停止此固定項目)' : ''))) return;
    if (isVirtual && originalSubId) {
        await supabase.from('user_subscriptions').update({ status: 'inactive' }).eq('id', originalSubId); fetchSubs();
    } else {
        await supabase.from('user_finance_records').delete().eq('id', id); fetchRecords();
    }
  }

  // Subscription Handlers
  function handleTemplateClick(template: any) {
    if (!user) return;
    const isCustom = template.id === 'custom';
    const defaultCat = template.category === 'others' ? '軟體/服務' : template.category;
    setFormSub({ id: 'new', name: isCustom ? '' : template.name, price_twd: template.defaultMonthlyPriceTwd, category: defaultCat, billing_cycle: 'monthly', status: 'active', start_date: new Date().toISOString().split('T')[0], duration_months: null, payment_method_id: null, linked_account_id: null, record_type: 'expense' });
    setIsCustomNameMode(isCustom); setIsTemplateModalOpen(false);
  }
  function handleEditSub(sub: Subscription) {
    const isKnown = subscriptionTemplates.some(t => t.name === sub.name);
    setFormSub({...sub}); setIsCustomNameMode(!isKnown);
  }
  async function saveSub(e: React.FormEvent) {
    e.preventDefault(); if (!formSub || !user) return;
    let pmId = formSub.payment_method_id;
    let accId = formSub.linked_account_id;
    if (isAddingCardMode && newCardData.bank_name) {
       const { data } = await supabase.from('user_payment_methods').insert({ user_id: user.id, ...newCardData }).select().single();
       if (data) pmId = data.id;
    }
    if (isAddingAccountMode && newAccountData.account_email) {
       const { data } = await supabase.from('user_accounts').insert({ user_id: user.id, ...newAccountData }).select().single();
       if (data) accId = data.id;
    }
    const payload = { name: formSub.name, price_twd: formSub.price_twd, billing_cycle: formSub.billing_cycle, category: formSub.category, start_date: formSub.start_date, duration_months: formSub.duration_months === 0 ? null : formSub.duration_months, payment_method_id: pmId, linked_account_id: accId, status: 'active', record_type: 'expense' };
    if (formSub.id === 'new') await supabase.from('user_subscriptions').insert({ user_id: user.id, ...payload });
    else await supabase.from('user_subscriptions').update(payload).eq('id', formSub.id);
    setFormSub(null); setIsAddingCardMode(false); setIsAddingAccountMode(false); fetchSubs(); fetchCards(); fetchAccounts();
  }
  async function deleteSub(id: string) {
    if(!confirm('刪除訂閱？')) return;
    await supabase.from('user_subscriptions').update({status:'inactive'}).eq('id',id); fetchSubs();
  }
  function handleNameSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedName = e.target.value;
    if (selectedName === 'custom_entry') { setIsCustomNameMode(true); setFormSub(prev => prev ? { ...prev, name: '' } : null); return; }
    const template = subscriptionTemplates.find(t => t.name === selectedName);
    if (template && formSub) { setFormSub({ ...formSub, name: template.name, price_twd: template.defaultMonthlyPriceTwd, category: template.category }); }
  }
  function handleCardSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'add_new_card') { setIsAddingCardMode(true); setFormSub(prev => prev ? { ...prev, payment_method_id: null } : null); }
    else { setIsAddingCardMode(false); setFormSub(prev => prev ? { ...prev, payment_method_id: val === 'none' ? null : val } : null); }
  }
  function handleAccountSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'add_new_account') { setIsAddingAccountMode(true); setFormSub(prev => prev ? { ...prev, linked_account_id: null } : null); }
    else { setIsAddingAccountMode(false); setFormSub(prev => prev ? { ...prev, linked_account_id: val === 'none' ? null : val } : null); }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Link href="/" className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 transition" title="回到首頁"><Home size={20} /></Link>
            <div className="h-8 w-[1px] bg-gray-300 mx-1 hidden md:block"></div>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={16}/></button>
              <span className="font-bold text-gray-700 px-2">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>
        <AuthButton />
      </div>

      {!user ? (
        <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-dashed">請先登入</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <TabButton active={activeTab === 'overview'} onClick={() => handleTabChange('overview')} icon={<PieChart size={18}/>} label="預算總表" />
            <TabButton active={activeTab === 'income'} onClick={() => handleTabChange('income')} icon={<DollarSign size={18}/>} label="收入管理" />
            <TabButton active={activeTab === 'expense'} onClick={() => handleTabChange('expense')} icon={<CreditCard size={18}/>} label="費用管理" />
            <TabButton active={activeTab === 'subscription'} onClick={() => handleTabChange('subscription')} icon={<Layers size={18}/>} label="訂閱管理" />
          </div>

          {/* Content */}
          <div className="min-h-[400px] pt-6">
            
            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center shadow-sm">
                  <div className="inline-block p-6 rounded-full bg-gray-50 mb-4">
                    <div className={`text-5xl font-bold ${netYearBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>${netYearBalance.toLocaleString()}</div>
                    <p className="text-gray-500 mt-2">{selectedYear} 年度預估淨現金流 (含訂閱)</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700">年度收支一覽 (聚合檢視)</div>
                    <div className="grid grid-cols-[200px_repeat(12,1fr)] bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <div className="p-4 sticky left-0 bg-gray-50 z-10 border-r">項目</div>
                      {months.map(m => <div key={m} className="p-4 text-center border-r last:border-r-0">{m}</div>)}
                    </div>
                    {overviewRows.map((row: any) => (
                      <div key={row.id} className="grid grid-cols-[200px_repeat(12,1fr)] border-b last:border-b-0 text-sm hover:bg-gray-50 transition">
                        <div className="p-4 font-medium text-gray-900 sticky left-0 bg-white border-r flex items-center justify-between group">
                          <span className={`truncate ${row.isVirtual ? 'text-blue-600' : ''}`}>{row.title}</span>
                        </div>
                        {row.monthlyAmounts.map((amt: number, idx: number) => <div key={idx} className={`p-4 text-center border-r border-gray-50 last:border-r-0 ${amt > 0 ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>{amt > 0 ? amt.toLocaleString() : '-'}</div>)}
                      </div>
                    ))}
                    <div className="grid grid-cols-[200px_repeat(12,1fr)] bg-gray-100 font-bold text-gray-900 text-sm">
                      <div className="p-4 sticky left-0 bg-gray-100 border-r border-gray-200">每月結餘</div>
                      {months.map((_, idx) => {
                        const total = getGridColumnTotal(idx, 'net');
                        return <div key={idx} className={`p-4 text-center border-r border-gray-200 last:border-r-0 ${total < 0 ? 'text-red-600' : ''}`}>{total.toLocaleString()}</div>
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Income / Expense / Subscription */}
            {activeTab !== 'overview' && (
              <div className="space-y-6">
                
                {activeTab === 'subscription' && (
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 text-sm">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>注意：</strong> 此處管理的訂閱項目，會自動匯入「預算總表」與「費用管理」進行計算。<br/>
                      請勿在「費用管理」頁面重複輸入這些訂閱支出，以免金額重複計算。
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg">{getTabIcon()}</div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">{getTabLabel()}</p>
                        <div className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
                          <span className="text-lg text-gray-400">$</span>
                          {getCurrentTabTotal().toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (activeTab === 'subscription') { setIsTemplateModalOpen(true); } 
                        else {
                          handleAddClick(activeTab);
                        }
                      }}
                      className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition shadow-sm active:scale-95"
                    >
                      <Plus size={18} />
                      <span>新增{activeTab === 'income' ? '收入' : activeTab === 'expense' ? '支出' : '訂閱'}</span>
                    </button>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-center gap-2 shadow-sm min-w-[200px]">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">檢視模式</span>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><LayoutList size={16} /> 列表</button>
                      <button onClick={() => setViewMode('grid')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Table2 size={16} /> 總表</button>
                    </div>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <div className="space-y-3">
                    {/* Subscription List (Pure Subs Only) */}
                    {activeTab === 'subscription' && pureSubscriptions.map(s => (
                        <div key={s.id} className="bg-white border border-gray-200 hover:border-indigo-300 transition p-4 rounded-xl flex items-center justify-between shadow-sm group">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center text-[10px] font-bold leading-tight bg-blue-50 text-blue-600`}>
                              {s.user_payment_methods ? <><span className="truncate max-w-[40px]">{s.user_payment_methods.bank_name.slice(0,2)}</span><span>{s.user_payment_methods.last_4_digits}</span></> : (s.billing_cycle === 'yearly' ? <Calendar size={20}/> : <CreditCard size={20}/>)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{s.name}</h3>
                                {s.user_accounts && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1"><User size={10}/> {s.user_accounts.account_email}</span>}
                              </div>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex gap-2 text-xs text-gray-500">
                                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{s.billing_cycle === 'yearly' ? '年繳' : '月繳'}</span>
                                </div>
                                <div className="text-xs text-gray-400">{s.start_date.split('-').join('/')} ~ {calculateEndDate(s.start_date, s.duration_months).split('-').join('/')}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right"><div className="font-bold text-gray-900">${s.price_twd.toLocaleString()}</div>{s.billing_cycle === 'yearly' && <div className="text-xs text-gray-400">(${Math.round(s.price_twd/12)}/月)</div>}</div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onClick={() => handleEditSub(s)} className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100"><Pencil size={18}/></button><button onClick={() => deleteSub(s.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100"><Trash2 size={18}/></button></div>
                          </div>
                        </div>
                    ))}

                    {(activeTab === 'income' || activeTab === 'expense') && expenseDisplayList.length === 0 && incomeDisplayList.length === 0 ? <div className="text-center py-12 text-gray-400 bg-white border-2 border-dashed border-gray-200 rounded-xl">尚無資料</div> : null}
                    
                    {activeTab === 'expense' && expenseDisplayList.map(r => (
                        <div key={r.id} className={`bg-white border border-gray-200 hover:border-gray-300 transition p-4 rounded-xl flex items-center justify-between shadow-sm group ${r.isVirtual ? 'border-blue-100 bg-blue-50/20' : ''}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${r.isVirtual ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{r.isVirtual ? <RefreshCw size={18}/> : <TrendingDown size={18}/>}</div>
                            <div><h3 className="font-semibold text-gray-900">{r.title}</h3><div className="flex gap-2 text-xs text-gray-500 mt-1"><span className={`px-2 py-0.5 rounded ${r.isVirtual ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r.isVirtual ? (r.title.includes('[分期]') ? '分期付款' : r.title.includes('[帳單]') ? '生活帳單' : '來自訂閱') : r.category}</span><span className="text-gray-400">{r.transaction_date.split('-').slice(1).join('/')}</span></div></div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="font-bold text-lg text-orange-600">-${r.amount.toLocaleString()}</div>
                            {/* [FIXED] 允許刪除虛擬紀錄 */}
                            {!r.isVirtual || (r.isVirtual && (r.title.includes('[分期]') || r.title.includes('[帳單]'))) ? (
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                   {!r.isVirtual && <button onClick={() => { setEditingRecord(r); setIsRecordModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100"><Pencil size={18}/></button>}
                                   <button onClick={() => deleteRecord(r.id, r.isVirtual, r.isVirtual ? r.source_sub_id : undefined)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100"><Trash2 size={18}/></button>
                                </div>
                            ) : (
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onClick={() => router.push('/tool/subscription-tracker')} className="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50"><LinkIcon size={18}/></button></div>
                            )}
                          </div>
                        </div>
                    ))}

                    {activeTab === 'income' && incomeDisplayList.map(r => (
                        <div key={r.id} className={`bg-white border border-gray-200 hover:border-gray-300 transition p-4 rounded-xl flex items-center justify-between shadow-sm group ${r.isVirtual ? 'border-blue-100 bg-blue-50/20' : ''}`}>
                          <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${r.isVirtual ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{r.isVirtual ? <RefreshCw size={18}/> : <TrendingUp size={18}/>}</div><div><h3 className="font-semibold text-gray-900">{r.title}</h3><div className="flex gap-2 text-xs text-gray-500 mt-1"><span className={`px-2 py-0.5 rounded ${r.isVirtual ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r.isVirtual ? '週期性' : r.category}</span><span className="text-gray-400">{r.transaction_date.split('-').slice(1).join('/')}</span></div></div></div>
                          <div className="flex items-center gap-6"><div className="font-bold text-lg text-green-600">+${r.amount.toLocaleString()}</div>
                          {!r.isVirtual ? (
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onClick={() => { setEditingRecord(r); setIsRecordModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100"><Pencil size={18}/></button><button onClick={() => deleteRecord(r.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100"><Trash2 size={18}/></button></div>
                          ) : (
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition"><span className="text-xs text-gray-400">自動匯入</span></div>
                          )}
                          </div>
                        </div>
                    ))}
                  </div>
                ) : (
                  // Grid View
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
                    <div className="min-w-[800px]">
                      <div className="grid grid-cols-[200px_repeat(12,1fr)] bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <div className="p-4 sticky left-0 bg-gray-50 z-10 border-r">項目 ({selectedYear})</div>
                        {months.map(m => <div key={m} className="p-4 text-center border-r last:border-r-0">{m}</div>)}
                      </div>
                      {getAggregatedRows(activeTab as 'income' | 'expense' | 'subscription').map((row: any) => (
                        <div key={row.id} className="grid grid-cols-[200px_repeat(12,1fr)] border-b last:border-b-0 text-sm hover:bg-gray-50 transition">
                          <div className="p-4 font-medium text-gray-900 sticky left-0 bg-white border-r flex items-center justify-between group">
                            <span className={`truncate ${row.isVirtual ? 'text-blue-600' : ''}`}>{row.title}</span>
                            {!row.isVirtual && activeTab !== 'subscription' && <button onClick={() => { setEditingRecord(row.original); setIsRecordModalOpen(true); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"><Pencil size={14}/></button>}
                            {activeTab === 'subscription' && <button onClick={() => handleEditSub(row.original)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"><Pencil size={14}/></button>}
                          </div>
                          {row.monthlyAmounts.map((amt: number, idx: number) => <div key={idx} className={`p-4 text-center border-r border-gray-50 last:border-r-0 ${amt > 0 ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>{amt > 0 ? amt.toLocaleString() : '-'}</div>)}
                        </div>
                      ))}
                      <div className="grid grid-cols-[200px_repeat(12,1fr)] bg-gray-100 font-bold text-gray-900 text-sm">
                        <div className="p-4 sticky left-0 bg-gray-100 border-r border-gray-200">年度總計</div>
                        {months.map((_, idx) => {
                          const total = getGridColumnTotal(idx, activeTab as 'income'|'expense'|'net');
                          return <div key={idx} className="p-4 text-center border-r border-gray-200 last:border-r-0">{total.toLocaleString()}</div>
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Record Modal */}
      {isRecordModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden p-0">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">{editingRecord.id === 'new' ? '新增' : '編輯'}{editingRecord.record_type === 'income' ? '收入' : '支出'}</h3>
              <button onClick={() => setIsRecordModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <form onSubmit={saveRecord} className="p-6 space-y-4">
              {editingRecord.record_type === 'income' && editingRecord.id === 'new' && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">收入類型</label><select value={inputTypeId} onChange={handleInputTypeChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none bg-white text-gray-900">{INCOME_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}</select></div>
              )}
              {editingRecord.record_type === 'expense' && editingRecord.id === 'new' && (
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">支出分類</label>
                   <select value={inputTypeId} onChange={handleInputTypeChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none bg-white text-gray-900"><option value="">-- 請選擇 --</option>{EXPENSE_CATEGORIES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}</select>
                   <div className="mt-3 flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="payMode" checked={paymentMode==='full'} onChange={() => setPaymentMode('full')} className="accent-black" /><span className="text-sm text-gray-700">一次付清</span></label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="payMode" checked={paymentMode==='installment'} onChange={() => setPaymentMode('installment')} className="accent-black" /><span className="text-sm text-gray-700">分期付款</span></label>
                   </div>
                </div>
              )}
              {((editingRecord.record_type === 'income' && (inputTypeId === 'other' || inputTypeId === 'windfall')) || (editingRecord.record_type === 'expense' && inputTypeId === 'other')) && (
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">說明 (標題)</label><input type="text" value={customNote} onChange={e => setCustomNote(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-black outline-none" placeholder="請輸入項目名稱" required /></div>
              )}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{paymentMode === 'installment' ? '總金額 (將自動攤提)' : '金額'}</label><input type="number" placeholder="0" value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-black focus:border-black outline-none transition" required /></div>
              {paymentMode === 'installment' && (
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">分期期數</label><input type="number" value={installments} onChange={e => setInstallments(parseInt(e.target.value)||1)} className="w-full p-2 border rounded text-sm text-gray-900" /></div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">年利率 (%)</label><input type="number" value={interestRate} onChange={e => setInterestRate(parseFloat(e.target.value)||0)} className="w-full p-2 border rounded text-sm text-gray-900" /></div>
                      <div className="col-span-2 text-xs text-blue-600 font-medium text-right">每期約繳: ${calculatedMonthlyPay.toLocaleString()}</div>
                  </div>
              )}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{isRecurringIncome ? '開始入帳日' : (paymentMode === 'installment' ? '首期扣款日' : '日期')}</label><input type="date" value={editingRecord.transaction_date} onChange={e => setEditingRecord({...editingRecord, transaction_date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-black focus:border-black outline-none transition" required />{isRecurringIncome && <p className="text-xs text-gray-500 mt-1">* 此項目將每月自動產生，直到您刪除為止。</p>}</div>
              <div className="pt-2 flex gap-3"><button type="button" onClick={() => setIsRecordModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium">取消</button><button type="submit" className="flex-1 py-3 bg-black text-white hover:bg-gray-800 rounded-lg transition font-medium flex justify-center gap-2 items-center"><Save size={18}/> {isRecurringIncome ? '新增固定收入' : (paymentMode==='installment'?'建立分期':'儲存')}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Modals (Template & Form) */}
      {isTemplateModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsTemplateModalOpen(false)}><div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}><div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center"><h3 className="font-bold text-lg text-gray-800">選擇訂閱服務</h3><button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div><div className="p-2 grid gap-1">{subscriptionTemplates.map(template => (<button key={template.id} onClick={() => handleTemplateClick(template)} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition flex justify-between group"><span className="font-medium text-gray-700 group-hover:text-black">{template.name}</span><span className="text-gray-400 text-sm group-hover:text-black">${template.defaultMonthlyPriceTwd}/月</span></button>))}</div></div></div>)}
      {formSub && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"><div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-lg text-gray-800">{formSub.id === 'new' ? '新增項目' : '編輯項目'}</h3><button onClick={() => setFormSub(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div><form onSubmit={saveSub} className="p-6 space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>{isCustomNameMode ? (<div className="flex gap-2"><input type="text" value={formSub.name} onChange={e => setFormSub({...formSub, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition text-gray-900" placeholder="輸入名稱..." required autoFocus /><button type="button" onClick={() => setIsCustomNameMode(false)} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><RefreshCw size={20} /></button></div>) : (<select value={subscriptionTemplates.some(t => t.name === formSub.name) ? formSub.name : 'custom_entry'} onChange={handleNameSelectChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none bg-white transition text-gray-900">{subscriptionTemplates.filter(t => t.id !== 'custom').map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}<option value="custom_entry">✎ 自訂 / 其他...</option></select>)}</div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">金額 (TWD)</label><input type="number" value={formSub.price_twd} onChange={e => setFormSub({...formSub, price_twd: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition text-gray-900" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">繳費週期</label><select value={formSub.billing_cycle} onChange={e => setFormSub({...formSub, billing_cycle: e.target.value as 'monthly'|'yearly'})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none bg-white transition text-gray-900"><option value="monthly">每月繳款</option><option value="yearly">每年繳款</option></select></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1">扣款信用卡</label><select value={isAddingCardMode ? 'add_new_card' : (formSub.payment_method_id || 'none')} onChange={handleCardSelectChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none bg-white transition text-gray-900"><option value="none">-- 無 / 現金 --</option>{paymentMethods.map(card => (<option key={card.id} value={card.id}>{card.bank_name} (末四碼 {card.last_4_digits})</option>))}<option value="add_new_card">＋ 新增常用信用卡...</option></select>{isAddingCardMode && (<div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2"><div className="text-xs font-bold text-gray-500 uppercase">新增卡片資訊</div><div className="grid grid-cols-2 gap-3"><input type="text" placeholder="銀行名稱 (如: 中信)" value={newCardData.bank_name} onChange={e => setNewCardData({...newCardData, bank_name: e.target.value})} className="p-2 border rounded-md text-sm text-gray-900" autoFocus /><input type="text" placeholder="末四碼 (如: 8888)" maxLength={4} value={newCardData.last_4_digits} onChange={e => setNewCardData({...newCardData, last_4_digits: e.target.value})} className="p-2 border rounded-md text-sm text-gray-900" /></div></div>)}</div>
               {/* 綁定帳號選單 */}
               <div><label className="block text-sm font-medium text-gray-700 mb-1">綁定帳號 (如: Netflix 的 Email)</label><select value={isAddingAccountMode ? 'add_new_account' : (formSub.linked_account_id || 'none')} onChange={handleAccountSelectChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none bg-white transition text-gray-900"><option value="none">-- 無 / 不指定 --</option>{userAccounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.account_email} {acc.account_label ? `(${acc.account_label})` : ''}</option>))}<option value="add_new_account">＋ 新增常用帳號...</option></select>{isAddingAccountMode && (<div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2"><div className="text-xs font-bold text-gray-500 uppercase">新增帳號資訊</div><div className="grid grid-cols-2 gap-3"><input type="email" placeholder="Email (如: arin@gmail.com)" value={newAccountData.account_email} onChange={e => setNewAccountData({...newAccountData, account_email: e.target.value})} className="p-2 border rounded-md text-sm text-gray-900 w-full" autoFocus /></div></div>)}</div>

               <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">開始扣款日</label><input type="date" value={formSub.start_date} onChange={e => setFormSub({...formSub, start_date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition text-gray-900" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">持續月數</label><input type="number" placeholder="∞" value={formSub.duration_months === null ? '' : formSub.duration_months} onChange={e => setFormSub({...formSub, duration_months: e.target.value === '' ? null : parseInt(e.target.value)})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition text-gray-900" /></div></div><div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg"><ArrowRight size={16} /><span>{formSub.duration_months ? `預計結束於：${calculateEndDate(formSub.start_date, formSub.duration_months)}` : '將持續訂閱直到手動取消'}</span></div><div className="pt-2 flex gap-3"><button type="button" onClick={() => setFormSub(null)} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">取消</button><button type="submit" className="flex-1 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition flex items-center justify-center gap-2"><Save size={18} />{formSub.id === 'new' ? '確認新增' : '儲存變更'}</button></div></form></div></div>
      )}
    </div>
  );
}

// --- Sub Components ---
function KpiCard({ label, amount, icon, color }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2"><span className="text-xs text-gray-500 font-medium">{label}</span><div className={`p-1.5 rounded-md ${color}`}>{icon}</div></div>
      <div className="text-xl font-bold text-gray-900">${amount.toLocaleString()}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 md:px-6 py-4 font-medium text-sm transition border-b-2 whitespace-nowrap ${active ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{icon} {label}</button>
  );
}