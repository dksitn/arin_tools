'use client';

import dynamic from 'next/dynamic';

const MapKernel = dynamic(() => import('./MapKernel'), {
  ssr: false, 
  loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-500">地圖引擎啟動中...</div>
});

export default function DynamicMap(props: any) {
  // 直接把所有收到的 props (包含 onMapSearch) 全部轉交給 MapKernel
  return <MapKernel {...props} />;
}