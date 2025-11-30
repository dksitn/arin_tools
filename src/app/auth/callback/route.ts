// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // [Check] 這裡抓取 next 參數，預設回首頁
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // Cloudflare 專用
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        // 本地開發：直接用 origin (http://localhost:3000)
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // 線上環境：強制 HTTPS 並使用轉發的 Host
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        // 備案：直接用 origin
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error('Auth Error:', error);
    }
  }

  // 驗證失敗或沒有 code，回首頁
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}