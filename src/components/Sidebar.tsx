'use client';

import Link from 'next/link';
import { ArrowLeft, Search, MapPin, Plus, X, Loader2, Check, Trash2 } from 'lucide-react';
import AuthButton from './AuthButton';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'arinslate@gmail.com'; 

const CATEGORY_OPTIONS = [
  { value: 'park', label: '🌲 公園綠地 (寵物友善)' },
  { value: 'life', label: '☕ 生活機能 (餐廳/咖啡廳)' },
  { value: 'infrastructure', label: '🏭 嫌惡設施 (工廠/電塔)' },
  { value: 'development', label: '🏗️ 房產開發 (重劃/都更)' },
  { value: 'other', label: '📍 其他地點' },
];

// ★ Props 改變了
export default function Sidebar({ 
  toolName, 
  signals, 
  onSearch, 
  guestCount 
}: { 
  toolName: string, 
  signals: any[], 
  onSearch: (addr: string) => void, 
  guestCount: number | null 
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<'explore' | 'review'>('explore');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', category: 'park' });
  const [pendingSignals, setPendingSignals] = useState<any[]>([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user?.email === ADMIN_EMAIL) setIsAdmin(true);
    };
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user);
      setIsAdmin(session?.user?.email === ADMIN_EMAIL);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchPendingSignals = useCallback(async () => {
    setIsLoadingReview(true);
    const { data } = await supabase.from('map_signals').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setPendingSignals(data);
    setIsLoadingReview(false);
  }, []);

  useEffect(() => {
    if (viewMode === 'review' && isAdmin) fetchPendingSignals();
  }, [viewMode, isAdmin, fetchPendingSignals]);

  const handleApprove = async (id: string) => {
    if (!confirm("確定要通過嗎？")) return;
    await supabase.from('map_signals').update({ status: 'approved' }).eq('id', id);
    alert("✅ 已通過！");
    fetchPendingSignals();
    router.refresh();
  };

  const handleReject = async (id: string) => {
    if (!confirm("確定要刪除嗎？")) return;
    await supabase.from('map_signals').delete().eq('id', id);
    alert("🗑️ 已刪除。");
    fetchPendingSignals();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('請輸入地點名稱');
    setIsSubmitting(true);
    let finalLat = 25.0330; 
    let finalLng = 121.5654;

    if (formData.address) {
      try {
        const cleanAddress = formData.address.replace(/\s+/g, '').trim();
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&accept-language=zh-TW`);
        const data = await response.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLng = parseFloat(data[0].lon);
        }
      } catch (err) { console.error(err); }
    }

    const { error } = await supabase.from('map_signals').insert({
      label: formData.name, address: formData.address, category: formData.category,
      lat: finalLat, lng: finalLng, status: 'pending', submitted_by: user.id, tags: ['pending_review'] 
    });
    setIsSubmitting(false);
    if (error) alert("新增失敗：" + error.message);
    else {
      alert("✅ 投稿成功！請等待管理員審核。");
      setIsModalOpen(false);
      setFormData({ name: '', address: '', category: 'park' });
      if (viewMode === 'review') fetchPendingSignals();
    }
  };

  // ★ 處理搜尋按鍵
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value;
      if (val) onSearch(val);
    }
  };

  return (
    <>
      <div className="w-full md:w-[400px] bg-white h-full flex flex-col shadow-xl z-20 border-r border-gray-200 relative">
        <div className="p-4 border-b border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="font-bold text-lg text-gray-800">{toolName}</h1>
            </div>
            <div className="scale-90 origin-right"><AuthButton /></div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              // ★ 顯示剩餘次數
              placeholder={guestCount !== null ? `搜尋地點 (訪客剩餘 ${guestCount} 次)...` : "搜尋地點或地址..."}
              onKeyDown={handleSearchKeyDown} // ★ 綁定按鍵
              disabled={guestCount === 0}
              className={`w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 text-gray-900 ${guestCount === 0 ? 'border-red-200 bg-red-50 placeholder-red-300' : 'border-gray-200 focus:ring-blue-500'}`} 
            />
          </div>
        </div>

        <div className="px-4 py-2 space-y-2">
          {user && !isAdmin && (
            <button onClick={() => setIsModalOpen(true)} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 text-blue-600 py-2 rounded-lg hover:bg-blue-50 font-medium text-sm transition-colors">
              <Plus size={16} /> 貢獻新地點
            </button>
          )}
          {isAdmin && (
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('explore')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'explore' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>瀏覽模式</button>
              <button onClick={() => setViewMode('review')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'review' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>審核隊列 ({pendingSignals.length})</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {viewMode === 'review' ? (
             isLoadingReview ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></div> :
             pendingSignals.map((signal) => (
              <div key={signal.id} className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm relative">
                <div className="absolute top-2 right-2 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">待審核</div>
                <h3 className="font-bold text-gray-800">{signal.label}</h3>
                {signal.address && <p className="text-xs text-gray-500 mt-1">{signal.address}</p>}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => handleApprove(signal.id)} className="flex-1 bg-green-50 text-green-700 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 flex items-center justify-center gap-1"><Check size={14} /> 通過</button>
                  <button onClick={() => handleReject(signal.id)} className="flex-1 bg-red-50 text-red-700 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 size={14} /> 刪除</button>
                </div>
              </div>
            ))
          ) : (
            // ★ 如果清單是空的，顯示提示
            signals.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p>此區域 3 公里內沒有資料</p>
                {guestCount !== null && <p className="text-xs mt-2 text-gray-300">訪客僅能查看搜尋點附近 3 公里</p>}
              </div>
            ) : (
              signals.map((signal) => (
                <div key={signal.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{signal.label}</h3>
                      <div className="flex items-center text-xs text-gray-500 mt-1 gap-1">
                        <MapPin size={12} />
                        {signal.address || `${signal.city} ${signal.district}`}
                      </div>
                    </div>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{signal.category}</span>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
      {/* Modal 部分省略 (沒變) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">📍 貢獻新地點</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地點名稱</label>
                <input type="text" required placeholder="例如：大安森林公園" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">詳細地址</label>
                <input type="text" placeholder="例如：台北市大安區新生南路..." className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選擇分類</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                  {CATEGORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} 
                  {isSubmitting ? '送出中...' : '確認投稿'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}