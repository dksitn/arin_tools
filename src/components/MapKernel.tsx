'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search } from 'lucide-react';
import L from 'leaflet'; // ★ 引入 Leaflet 原生核心

// 小幫手：當外部傳入 center 改變時，地圖飛過去
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// ★ 新增：3公里範圍指示器 (改用原生 L.circle 實作，修復 appendChild 錯誤)
function RadiusIndicator() {
  const map = useMap();

  useEffect(() => {
    // 1. 直接建立一個 Leaflet 圓圈
    const circle = L.circle(map.getCenter(), {
      radius: 3000, // 3000公尺
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '10, 10' // 虛線
    });

    // 2. 把圓圈加到地圖上
    circle.addTo(map);

    // 3. 定義一個更新函數：地圖動，圓圈就跟著動
    const updatePosition = () => {
      circle.setLatLng(map.getCenter());
    };

    // 4. 監聽地圖移動事件
    map.on('move', updatePosition);

    // 5. 當元件移除時 (Cleanup)，把圓圈刪掉，避免殘留
    return () => {
      map.off('move', updatePosition);
      circle.remove();
    };
  }, [map]); // 只在 map 初始化時執行一次

  return null; // 這個元件不需要渲染任何 JSX，它只負責邏輯
}

// 搜尋按鈕
function SearchControl({ onSearchHere }: { onSearchHere: (lat: number, lng: number) => void }) {
  const map = useMap();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400]">
      <button 
        onClick={() => {
          const center = map.getCenter();
          onSearchHere(center.lat, center.lng);
        }}
        className="bg-white text-gray-800 px-4 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all border border-gray-200"
      >
        <Search size={16} className="text-blue-600" />
        搜尋此區域 (3km)
      </button>
    </div>
  );
}

export default function MapKernel({ 
  config, 
  signals, 
  onMapSearch 
}: { 
  config: any, 
  signals: any[],
  onMapSearch?: (lat: number, lng: number) => void 
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return <div className="p-10 text-center">地圖引擎啟動中...</div>;

  const center = config?.initial_view?.center || [25.0330, 121.5654];
  const zoom = config?.initial_view?.zoom || 13;

  return (
    <div className="h-full w-full relative z-0 group">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater center={center} />
        
        {/* 加入範圍指示器 */}
        <RadiusIndicator />

        {onMapSearch && <SearchControl onSearchHere={onMapSearch} />}

        {signals.map((signal) => (
          <CircleMarker 
            key={signal.id}
            center={[signal.lat, signal.lng]}
            radius={8}
            pathOptions={{ 
              color: 'white', 
              fillColor: config.ui_theme === 'danger' ? '#ef4444' : 
                         config.ui_theme === 'nature' ? '#22c55e' : '#a855f7',
              fillOpacity: 0.9,
              weight: 2
            }}
          >
            <Popup>
              <div className="font-bold">{signal.label}</div>
              {signal.address && <div className="text-xs text-gray-600">{signal.address}</div>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* 中央準心 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none">
        <div className="relative">
          <div className="w-4 h-4 bg-gray-800 rounded-full border-2 border-white shadow-sm"></div>
          {/* 十字線 */}
          <div className="absolute top-1/2 left-[-12px] w-[12px] h-[2px] bg-gray-800/50 -translate-y-1/2"></div>
          <div className="absolute top-1/2 right-[-12px] w-[12px] h-[2px] bg-gray-800/50 -translate-y-1/2"></div>
          <div className="absolute top-[-12px] left-1/2 w-[2px] h-[12px] bg-gray-800/50 -translate-x-1/2"></div>
          <div className="absolute bottom-[-12px] left-1/2 w-[2px] h-[12px] bg-gray-800/50 -translate-x-1/2"></div>
        </div>
      </div>
      
    </div>
  );
}