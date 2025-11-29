// src/app/api/seed/route.ts
import { NextResponse } from 'next/server';
// [FIX] 改用新的 utils 路徑
import { createClient } from '@/utils/supabase/server'; 

import toolsData from '@/data/tools_directory.json';
import categoriesData from '@/data/tool_categories.json';
import signalsData from '@/data/signals.json'; 

export const runtime = 'edge';

export async function GET() {
  // [FIX] 初始化 Supabase Client (記得 await)
  const supabase = await createClient();

  try {
    // 1. 同步分類
    const { error: catError } = await supabase
      .from('tool_categories')
      .upsert(categoriesData, { onConflict: 'id' });
    
    if (catError) throw new Error(`分類同步失敗: ${catError.message}`);

    // 2. 同步工具目錄
    const { error: toolError } = await supabase
      .from('tools_directory')
      .upsert(toolsData, { onConflict: 'slug' });

    if (toolError) throw new Error(`工具目錄同步失敗: ${toolError.message}`);

    // 3. 同步地圖訊號
    const { error: signalError } = await supabase
      .from('map_signals')
      .upsert(signalsData, { onConflict: 'id' });

    if (signalError) throw new Error(`地圖訊號同步失敗: ${signalError.message}`);

    return NextResponse.json({ 
      message: '✅ 資料同步成功！',
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