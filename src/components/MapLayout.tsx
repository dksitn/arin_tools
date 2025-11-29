'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from './Sidebar';
import DynamicMap from './DynamicMap';

// 計算距離公式
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; 
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
function deg2rad(deg: number) { return deg * (Math.PI/180) }

export default function MapLayout({ tool, allSignals }: { tool: any, allSignals: any[] }) {
  const [user, setUser] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(tool.kernel_config?.initial_view?.center || [25.0330, 121.5654]);
  const [displaySignals, setDisplaySignals] = useState<any[]>([]); // ★ 預設不顯示，等使用者按搜尋
  
  const [guestSearchCount, setGuestSearchCount] = useState(3); 
  const [isLimitReached, setIsLimitReached] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();
  }, []);

  // ★ 共用的搜尋邏輯 (不管是文字搜，還是地圖搜，都走這裡)
  const performSearch = (lat: number, lng: number) => {
    // 1. 檢查限制
    if (!user) {
      if (guestSearchCount <= 0) {
        setIsLimitReached(true);
        return;
      }
      setGuestSearchCount(prev => prev - 1);
    }

    // 2. 更新地圖中心 (讓地圖飛過去)
    setMapCenter([lat, lng]);

    // 3. 過濾資料
    if (user) {
      // 會員：顯示全部 (或者你可以改成會員也只顯示附近，看你需求)
      // 這邊示範：會員顯示全部，但會定位到該處
      setDisplaySignals(allSignals);
    } else {
      // 訪客：只顯示 3km 內
      const filtered = allSignals.filter(signal => {
        const dist = getDistanceFromLatLonInKm(lat, lng, signal.lat, signal.lng);
        return dist <= 3;
      });
      setDisplaySignals(filtered);
    }
  };

  // 側邊欄文字搜尋
  const handleTextSearch = async (address: string) => {
    try {
      const cleanAddress = address.replace(/\s+/g, '').trim();
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&accept-language=zh-TW`);
      const data = await response.json();
      if (data && data.length > 0) {
        performSearch(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        alert("找不到此地點");
      }
    } catch (e) { alert("搜尋錯誤"); }
  };

  // ★ 地圖按鈕搜尋 (直接拿到經緯度)
  const handleMapSearch = (lat: number, lng: number) => {
    performSearch(lat, lng);
  };

  // 如果登入了，自動顯示所有資料
  useEffect(() => {
    if (user) setDisplaySignals(allSignals);
  }, [user, allSignals]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white relative">
      
      {/* 限制次數遮罩 */}
      {isLimitReached && !user && (
        <div className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md mx-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
            <h2 className="text-2xl font-bold mb-2">搜尋次數已達上限</h2>
            <p className="text-gray-500 mb-6">訪客僅能搜尋 3 次。請登入會員以解鎖無限功能。</p>
            <button onClick={() => setIsLimitReached(false)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 w-full">
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 左側 */}
      <div className="shrink-0 h-full z-10 relative shadow-2xl">
        <Sidebar 
          toolName={tool.name} 
          signals={displaySignals} 
          onSearch={handleTextSearch}  
          guestCount={user ? null : guestSearchCount} 
        />
      </div>

      {/* 右側 */}
      <div className="flex-grow h-full relative z-0">
        <DynamicMap 
          config={{ ...tool.kernel_config, initial_view: { ...tool.kernel_config.initial_view, center: mapCenter } }} 
          signals={displaySignals}
          onMapSearch={handleMapSearch} // ★ 傳入地圖搜尋功能
        />
      </div>
    </div>
  );
}