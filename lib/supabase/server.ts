import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 运行时检查配置是否存在
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '❌ Supabase 未配置! 请通过环境变量设置:\n' +
      'NEXT_PUBLIC_SUPABASE_URL\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      '获取配置: https://supabase.com/dashboard/project/_/settings/api'
    )
  }

  // 检查是否使用了占位符
  if (supabaseUrl.includes('your-project-id') || 
      supabaseUrl.includes('placeholder') ||
      supabaseAnonKey.includes('your-anon-key') ||
      supabaseAnonKey.includes('placeholder')) {
    throw new Error(
      '❌ 请替换环境变量中的占位符为真实的 Supabase 配置'
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
