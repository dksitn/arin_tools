// src/app/tool/[slug]/page.tsx
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import MapKernel from '@/components/MapKernel';
import SubscriptionKernel from '@/components/SubscriptionKernel';
import { Metadata } from 'next';

// 設定 Edge Runtime
export const runtime = 'edge';

// Metadata 生成邏輯
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const titleName = params.slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return {
    title: titleName,
  };
}

export default async function ToolPage({ params }: { params: { slug: string } }) {
  // 1. 初始化 Supabase (注意：這裡必須有 await)
  const supabase = await createClient();
  const { slug } = params;

  // 2. 從 tools_directory 讀取設定
  const { data: tool } = await supabase
    .from('tools_directory')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!tool) {
    return notFound();
  }

  // 3. 核心分流 (Dispatcher)
  switch (tool.kernel_code) {
    case 'MAP_LEAFLET_V1':
      // 讀取地圖資料 (MapKernel 需要 signals)
      const { data: signals } = await supabase
        .from('map_signals')
        .select('*')
        .eq('status', 'approved');
      
      return (
        <div className="h-[calc(100vh-64px)] w-full">
           <MapKernel 
             config={tool.kernel_config} 
             signals={signals || []} 
           />
        </div>
      );
      
    case 'SUBSCRIPTION_V1':
      // 呼叫訂閱核心 (不需要 signals)
      return (
        <div className="min-h-screen bg-gray-50 py-8">
           <div className="max-w-4xl mx-auto px-4 mb-6">
              <h1 className="text-2xl font-bold text-gray-800">{tool.name}</h1>
              <p className="text-gray-500">{tool.kernel_config?.description}</p>
           </div>
           <SubscriptionKernel config={tool.kernel_config} />
        </div>
      );

    default:
      return (
        <div className="p-10 text-center">
          <h1 className="text-xl font-bold text-red-500">未知的核心代碼</h1>
          <p>系統不支援 Kernel Code: {tool.kernel_code}</p>
        </div>
      );
  }
}