'use client'; // 這是告訴 Next.js 這是前端元件

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Map, Shield, DollarSign, LayoutGrid } from 'lucide-react'; // 漂亮的圖示
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';

export default function Home() {
  const [tools, setTools] = useState<any[]>([]);

  // 這一區是負責去資料庫抓資料的
  useEffect(() => {
    async function fetchTools() {
      const { data, error } = await supabase
        .from('tools_directory')
        .select('*')
        .eq('status', 'active') // 只抓 active 的工具
        .order('category_id');
      
      if (data) setTools(data);
      if (error) console.error('抓取失敗:', error);
    }
    fetchTools();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* 標題區 */}
      <header className="max-w-5xl mx-auto mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Arin Slate 的工具大全</h1>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800">
             👋 歡迎來到城市情報中心 v1.0。所有資料皆即時來自 Supabase 資料庫。
          </div>
        </div>
        
        {/* 這裡加入了登入按鈕 */}
        <div className="shrink-0">
          <AuthButton />
        </div>
      </header>

      {/* 卡片列表區 */}
      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <div key={tool.slug} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                {/* 根據分類顯示不同圖示 */}
                {tool.category_id === 'security' && <Shield className="w-6 h-6 text-red-500" />}
                {tool.category_id === 'life' && <Map className="w-6 h-6 text-green-500" />}
                {tool.category_id === 'finance' && <DollarSign className="w-6 h-6 text-purple-500" />}
                {!['security', 'life', 'finance'].includes(tool.category_id) && <LayoutGrid className="w-6 h-6 text-gray-500" />}
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                {tool.category_id}
              </span>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">{tool.name}</h2>
            <p className="text-gray-600 text-sm mb-6 flex-grow">{tool.short_description}</p>
            <Link 
              href={`/tool/${tool.slug}`}
              className="block w-full text-center py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
>             進入工具 →
            </Link>
            
          </div>
        ))}
      </main>
    </div>
  );
}