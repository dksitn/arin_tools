'use client';

import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';

export default function AuthButton() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- 狀態 A: 已登入 (修復版) ---
  if (user) {
    return (
      <div className="flex items-center gap-3 bg-white pl-2 pr-4 py-1.5 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-shadow max-w-[200px]">
        {/* 1. 外層容器加入 shrink-0 防止被擠扁 */}
        <div className="w-8 h-8 shrink-0 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 overflow-hidden">
          {user.user_metadata.avatar_url ? (
            /* 2. 加入 referrerPolicy 解決 Google 圖片破圖問題 */
            <img 
              src={user.user_metadata.avatar_url} 
              alt="User" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <User size={16} />
          )}
        </div>
        
        {/* 3. 文字區塊加入 min-w-0 讓 truncate 生效 */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Member</span>
          <span className="text-xs font-medium text-gray-700 truncate block">
            {user.user_metadata.full_name || user.email}
          </span>
        </div>

        <button 
          onClick={handleLogout} 
          className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
          title="登出"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  // --- 狀態 B: 未登入 ---
  return (
    <button 
      onClick={handleLogin}
      className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-full border border-gray-300 font-medium text-sm hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm active:scale-95"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      <span>Google 登入</span>
    </button>
  );
}