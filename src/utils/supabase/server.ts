import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    // ▼▼▼ 1. 直接貼上你的 URL (字串要用引號包起來) ▼▼▼
    'https://zddyqifegjtwvjjtkdrn.supabase.co', 
    
    // ▼▼▼ 2. 直接貼上你的 ANON KEY (字串要用引號包起來) ▼▼▼
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZHlxaWZlZ2p0d3ZqanRrZHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNDE0MjMsImV4cCI6MjA3OTgxNzQyM30.BHghPV-8AsuPCBZO-oxvpARWe2JCep66_0gP-HwBsrE',
    
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
          }
        },
      },
    }
  )
}