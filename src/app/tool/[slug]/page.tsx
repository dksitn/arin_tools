import { supabase } from '@/lib/supabaseClient';
import MapLayout from '@/components/MapLayout'; // 改用 MapLayout

export const runtime = 'edge';

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: tool } = await supabase.from('tools_directory').select('*').eq('slug', slug).single();
  if (!tool) return <div>找不到工具</div>;

  const targetTags = tool.kernel_config?.filter_tags || [];
  let query = supabase.from('map_signals').select('*').eq('status', 'approved'); // 只抓 approved
  
  if (targetTags.length > 0) {
    query = query.contains('tags', targetTags);
  }

  const { data: signals } = await query;

  return (
    // 使用新的 Layout，它會負責處理左邊和右邊的邏輯
    <MapLayout tool={tool} allSignals={signals || []} />
  );
}