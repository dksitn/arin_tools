import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// 引入你的 JSON 檔案
// 注意：我們之前因為緩存問題，把 map_signals.json 改名為 signals.json 了，這裡要對應
import toolsData from '@/data/tools_directory.json';
import categoriesData from '@/data/tool_categories.json';
import signalsData from '@/data/signals.json'; 

export const runtime = 'edge';

export async function GET() {
  try {
    // 1. 同步分類 (Categories)
    const { error: catError } = await supabase
      .from('tool_categories')
      .upsert(categoriesData, { onConflict: 'id' });
    
    if (catError) throw new Error(`分類同步失敗: ${catError.message}`);

    // 2. 同步工具目錄 (Tools)
    const { error: toolError } = await supabase
      .from('tools_directory')
      .upsert(toolsData, { onConflict: 'slug' });

    if (toolError) throw new Error(`工具目錄同步失敗: ${toolError.message}`);

    // 3. 同步地圖訊號 (Signals)
    // 注意：Signals 比較多，我們用 upsert 覆蓋
    const { error: signalError } = await supabase
      .from('map_signals')
      .upsert(signalsData, { onConflict: 'id' });

    if (signalError) throw new Error(`地圖訊號同步失敗: ${signalError.message}`);

    return NextResponse.json({ 
      message: '✅ 資料同步成功！VS Code 的內容已更新至 Supabase。',
      details: {
        categories: categoriesData.length,
        tools: toolsData.length,
        signals: signalsData.length
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}