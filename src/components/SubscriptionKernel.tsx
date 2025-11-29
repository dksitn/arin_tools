'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { subscriptionTemplates } from '@/data/subscriptionTemplates';
import { Trash2, Plus, CreditCard, Calendar } from 'lucide-react';

export default function SubscriptionKernel({ config }: { config: any }) {
  const supabase = createClient();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 計算總月費 (自動攤提年繳)
  const totalCost = subscriptions.reduce((sum, item) => {
    const monthly = item.billing_cycle === 'yearly' ? Math.round(item.price_twd / 12) : item.price_twd;
    return sum + monthly;
  }, 0);

  useEffect(() => {
    fetchSubs();
  }, []);

  async function fetchSubs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setLoading(false);
        return; 
    }

    // 只抓取狀態為 active 的訂閱
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active') 
      .order('price_twd', { ascending: false });

    if (data) setSubscriptions(data);
    setLoading(false);
  }

  async function addSub(template: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('請先登入才能使用此功能！');
      return;
    }

    // 簡單的輸入邏輯 (如果是自訂項目)
    let finalName = template.name;
    let finalPrice = template.defaultMonthlyPriceTwd;

    if (template.id === 'custom') {
        const inputName = prompt('請輸入訂閱名稱', '我的訂閱');
        if (!inputName) return;
        finalName = inputName;
        
        const inputPrice = prompt('請輸入每月金額', '100');
        if (!inputPrice) return;
        finalPrice = parseInt(inputPrice);
    }

    const { error } = await supabase.from('user_subscriptions').insert({
      user_id: user.id,
      name: finalName,
      category: template.category,
      price_twd: finalPrice,
      billing_cycle: 'monthly',
      status: 'active'
    });

    if (error) {
        console.error(error);
        alert('新增失敗，請稍後再試');
    } else {
      setIsModalOpen(false);
      fetchSubs(); // 重新整理列表
    }
  }

  async function deleteSub(id: string) {
    if(!confirm('確定要移除這個訂閱嗎？(將封存至歷史紀錄)')) return;
    
    // 軟刪除：只改狀態，不刪資料 (符合你的時間軸記憶需求)
    await supabase
      .from('user_subscriptions')
      .update({ status: 'inactive' }) 
      .eq('id', id);
      
    fetchSubs();
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* 總金額卡片 */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-indigo-100 text-sm font-medium mb-1">每月預估總支出</h2>
          <div className="text-4xl font-bold flex items-baseline gap-1">
            <span className="text-2xl">$</span>
            {totalCost.toLocaleString()}
          </div>
          <p className="text-xs text-indigo-200 mt-2 opacity-80">包含年繳項目的月攤提</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition backdrop-blur-sm"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* 訂閱列表 */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10">讀取中...</p>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-500">還沒有訂閱項目，點擊 + 號開始記帳</p>
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div key={sub.id} className="bg-white border hover:border-indigo-300 transition p-4 rounded-xl flex items-center justify-between shadow-sm group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-500">
                  {sub.billing_cycle === 'yearly' ? <Calendar size={18}/> : <CreditCard size={18} />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{sub.name}</h3>
                  <div className="flex gap-2 text-xs text-gray-500 mt-1">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {sub.billing_cycle === 'yearly' ? '年繳' : '月繳'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                    <div className="font-bold text-gray-700">${sub.price_twd.toLocaleString()}</div>
                    {sub.billing_cycle === 'yearly' && (
                        <div className="text-xs text-gray-400">(${Math.round(sub.price_twd/12)}/月)</div>
                    )}
                </div>
                <button 
                  onClick={() => deleteSub(sub.id)}
                  className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 選擇模組 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">新增訂閱</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-2 grid gap-1">
              {subscriptionTemplates.map(template => (
                <button 
                  key={template.id}
                  onClick={() => addSub(template)}
                  className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl transition flex justify-between group"
                >
                  <span className="font-medium text-gray-700 group-hover:text-indigo-700">{template.name}</span>
                  {template.defaultMonthlyPriceTwd > 0 && (
                      <span className="text-gray-400 text-sm">${template.defaultMonthlyPriceTwd}/月</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}