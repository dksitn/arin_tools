import AuthButton from '@/components/AuthButton';
import ToolGrid from '@/components/ToolGrid';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Arin Slate 的工具大全</h1>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg text-sm font-medium border border-blue-100">
              <span>👋</span>
              <span>歡迎來到城市情報中心 v1.0。所有資料皆即時來自 Supabase 資料庫。</span>
            </div>
          </div>
          <div className="shrink-0">
            <AuthButton />
          </div>
        </header>

        {/* Tool Grid Section */}
        <section>
          {/* 傳入管理員 Email，開啟上帝視角 */}
          <ToolGrid adminEmail="arinslate@gmail.com" />
        </section>

      </div>
    </div>
  );
}