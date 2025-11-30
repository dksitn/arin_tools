'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Heart, Eye, EyeOff, Loader2, Shield, Map, DollarSign, LayoutGrid } from 'lucide-react';

// 定義資料型態
interface Tool {
  slug: string;
  name: string;
  category_id: string;
  is_hidden: boolean;
  description?: string;
  favorite_count?: number; // Admin 看到的統計數據
}

interface ToolGridProps {
  adminEmail: string; // 'arinslate@gmail.com'
}

export default function ToolGrid({ adminEmail }: ToolGridProps) {
  const supabase = createClient();
  const [tools, setTools] = useState<Tool[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]); // 我按過愛心的 slug
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 嚴格判斷管理員身分
  const isAdmin = !!userEmail && !!adminEmail && userEmail === adminEmail;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // 1. 取得當前使用者
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || null;
    setUserEmail(email);

    // 2. 取得所有工具
    // 注意：RLS 已經設定好了，一般人只會抓到 is_hidden=false 的，Admin 會抓到全部
    const { data: toolsData } = await supabase
      .from('tools_directory')
      .select('*')
      .order('slug');

    if (toolsData) {
      let finalTools = toolsData;

      // [Admin Feature] 如果是管理員，額外統計每個工具的愛心數
      if (email && email === adminEmail) {
        const { data: allFavs } = await supabase.from('user_tool_favorites').select('tool_slug');
        
        // 計算每個 slug 被按讚的次數
        const counts: Record<string, number> = {};
        allFavs?.forEach(f => { counts[f.tool_slug] = (counts[f.tool_slug] || 0) + 1 });
        
        finalTools = toolsData.map(t => ({
          ...t,
          favorite_count: counts[t.slug] || 0
        }));
      }
      setTools(finalTools);
    }

    // 3. 取得 "我" 的收藏 (用於顯示紅心與排序)
    if (user) {
      const { data: myFavs } = await supabase
        .from('user_tool_favorites')
        .select('tool_slug')
        .eq('user_id', user.id);
      if (myFavs) {
        setFavorites(myFavs.map(f => f.tool_slug));
      }
    }
    setLoading(false);
  }

  // 切換愛心 (Toggle Favorite)
  async function toggleFavorite(slug: string) {
    if (!userEmail) return alert("請先登入才能收藏工具！");

    const isFav = favorites.includes(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 樂觀更新 UI
    if (isFav) {
      setFavorites(prev => prev.filter(s => s !== slug));
      await supabase.from('user_tool_favorites').delete().match({ user_id: user.id, tool_slug: slug });
    } else {
      setFavorites(prev => [...prev, slug]);
      await supabase.from('user_tool_favorites').insert({ user_id: user.id, tool_slug: slug });
    }
  }

  // 切換隱藏狀態 (Admin Only)
  async function toggleHidden(slug: string, currentHidden: boolean) {
    if (!isAdmin) return;
    
    const { error } = await supabase
      .from('tools_directory')
      .update({ is_hidden: !currentHidden })
      .eq('slug', slug);

    if (!error) {
      setTools(prev => prev.map(t => t.slug === slug ? { ...t, is_hidden: !currentHidden } : t));
    }
  }

  // [核心排序邏輯]
  const sortedTools = [...tools].sort((a, b) => {
    const aFav = favorites.includes(a.slug) ? 1 : 0;
    const bFav = favorites.includes(b.slug) ? 1 : 0;
    
    // 1. 先比愛心
    if (aFav !== bFav) return bFav - aFav;
    
    // 2. 再比是否隱藏 (沒隱藏的排前面)
    if (a.is_hidden !== b.is_hidden) return a.is_hidden ? 1 : -1;

    // 3. 最後比名稱
    return a.name.localeCompare(b.name);
  });

  // Helper: 取得分類 icon
  const getIcon = (cat: string) => {
    switch(cat) {
      case 'security': return <Shield className="w-6 h-6 text-red-500" />;
      case 'life': return <Map className="w-6 h-6 text-green-500" />;
      case 'finance': return <DollarSign className="w-6 h-6 text-purple-500" />;
      default: return <LayoutGrid className="w-6 h-6 text-gray-500" />;
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400"/></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedTools.map((tool) => {
        const isFav = favorites.includes(tool.slug);
        
        return (
          <div 
            key={tool.slug} 
            className={`relative bg-white rounded-xl shadow-sm border transition-all flex flex-col
              ${tool.is_hidden ? 'border-dashed border-gray-300 bg-gray-50 opacity-75' : 'border-gray-100 hover:shadow-md'}
            `}
          >
            {/* 卡片內容區 */}
            <div className="p-6 flex-grow">
              <div className="flex items-start justify-between mb-4">
                {/* 分類 Icon */}
                <div className="p-3 bg-gray-100 rounded-lg">
                  {getIcon(tool.category_id)}
                </div>

                <div className="flex items-center gap-2">
                  {/* [Admin] 上帝視角控制區 */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 mr-2 border-r pr-2 border-gray-200">
                       <span className="text-xs text-gray-500 font-mono flex items-center gap-0.5" title="全站總收藏數">
                         {tool.favorite_count || 0}<Heart size={10} className="fill-gray-400 text-gray-400"/>
                       </span>
                       <button 
                         onClick={(e) => { e.preventDefault(); toggleHidden(tool.slug, !!tool.is_hidden); }}
                         className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-200 transition"
                         title={tool.is_hidden ? "上架 (取消隱藏)" : "下架 (隱藏)"}
                       >
                         {tool.is_hidden ? <EyeOff size={16}/> : <Eye size={16}/>}
                       </button>
                    </div>
                  )}

                  {/* 愛心按鈕 */}
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleFavorite(tool.slug); }}
                    className={`transition-transform active:scale-90 p-1.5 rounded-full hover:bg-gray-50 ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-300'}`}
                    title={isFav ? "取消收藏" : "收藏此工具"}
                  >
                    <Heart size={20} fill={isFav ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{tool.name}</h3>
              <p className="text-gray-600 text-sm line-clamp-2">
                {/* 顯示資料庫描述，若無則顯示預設 */}
                {(tool as any).description || (tool as any).kernel_config?.description || "點擊下方按鈕進入使用此工具..."}
              </p>
            </div>

            {/* 底部按鈕區 */}
            <div className="p-6 pt-0 mt-auto">
              <Link 
                href={`/tool/${tool.slug}`}
                className="block w-full text-center py-3 rounded-lg font-medium transition-colors bg-gray-900 text-white hover:bg-gray-800"
              >
                進入工具 →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}