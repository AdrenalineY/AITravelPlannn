import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 服务端也需要验证环境变量
  if (!supabaseUrl || !supabaseAnonKey || 
      supabaseUrl.includes('your-project-id') || 
      supabaseAnonKey.includes('your-anon-key')) {
    throw new Error(
      '❌ Supabase 未配置! 请查看 .env.local 文件并填入正确的 Supabase 项目配置。\n' +
      '获取配置: https://supabase.com/dashboard/project/_/settings/api'
    )
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // 服务器组件中设置 cookie 可能会失败
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // 服务器组件中删除 cookie 可能会失败
          }
        },
      },
    }
  )
}
