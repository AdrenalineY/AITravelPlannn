import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 运行时检查配置
  if (!supabaseUrl || !supabaseAnonKey) {
    // 在浏览器环境显示友好错误
    if (typeof window !== 'undefined') {
      throw new Error(
        '❌ Supabase 未配置!\n\n' +
        '请按以下步骤配置:\n' +
        '1. 访问 https://supabase.com/dashboard 创建项目\n' +
        '2. 在项目设置中找到 API 配置\n' +
        '3. 设置环境变量:\n' +
        '   NEXT_PUBLIC_SUPABASE_URL\n' +
        '   NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
        '4. 重启应用\n\n' +
        '当前配置状态:\n' +
        `- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || '未设置'}\n` +
        `- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '已设置但可能是占位符' : '未设置'}`
      )
    }
    // 服务端构建时抛出错误
    throw new Error('❌ Supabase 环境变量未设置')
  }

  // 检查是否使用了占位符
  if (supabaseUrl.includes('your-project-id') || 
      supabaseUrl.includes('placeholder') ||
      supabaseAnonKey.includes('your-anon-key') ||
      supabaseAnonKey.includes('placeholder')) {
    throw new Error('❌ 请替换环境变量中的占位符为真实的 Supabase 配置')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // 从 document.cookie 中获取
        if (typeof document === 'undefined') return undefined
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift()
        return undefined
      },
      set(name: string, value: string, options: any) {
        // 设置到 document.cookie
        if (typeof document === 'undefined') return
        let cookieString = `${name}=${value}`
        if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`
        if (options?.path) cookieString += `; path=${options.path}`
        if (options?.domain) cookieString += `; domain=${options.domain}`
        if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`
        if (options?.secure) cookieString += '; secure'
        document.cookie = cookieString
      },
      remove(name: string, options: any) {
        // 从 document.cookie 中删除
        if (typeof document === 'undefined') return
        let cookieString = `${name}=; max-age=0`
        if (options?.path) cookieString += `; path=${options.path}`
        if (options?.domain) cookieString += `; domain=${options.domain}`
        document.cookie = cookieString
      },
    },
  })
}
