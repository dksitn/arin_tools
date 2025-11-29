import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import MapKernel from '@/components/MapKernel';
import SubscriptionKernel from '@/components/SubscriptionKernel';
import { Metadata } from 'next';

export const runtime = 'edge';

// Metadata 也要 await params
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; // ▼▼▼ 關鍵修正 1 ▼▼▼
  const titleName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return {
    title: titleName,
  };
}

// Page 主程式
export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  // ▼▼▼ 關鍵修正 2：加上 await ▼▼▼
  const { slug } = await params; 
  
  // 初始化 Supabase (為了安全，建議改回用 createClient() 讀取環境變數，不要留硬編碼)
  // 請確認你的 utils/supabase/server.ts 已經改回讀取 process.env 了嗎？
  // 如果還沒，這裡先暫時用 hardcode 測試也行，但建議改回來。
  const supabase = await createClient();

  // 1. 從 tools_directory 讀取設定
  const { data: tool } = await supabase
    .from('tools_directory')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!tool) {
    // 為了除錯，如果找不到，我們不要直接 notFound，而是印出來看看 (Debug 模式)
    return (
      <div className="p-10 text-center text-white bg-gray-900 min-h-screen">
        <h1 className="text-xl text-red-500 font-bold">Debug: Tool Not Found</h1>
        <p>Searching for Slug: <strong>{slug}</strong></p>
        <p>Supabase returned null.</p>
      </div>
    );
  }

  // 2. 核心分流 (Dispatcher)
  switch (tool.kernel_code) {
    case 'MAP_LEAFLET_V1':
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
          <p>Code: {tool.kernel_code}</p>
        </div>
      );
  }
}