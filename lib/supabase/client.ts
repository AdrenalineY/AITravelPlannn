import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 在开发环境中,如果未配置 Supabase,提供友好的错误提示
  if (!supabaseUrl || !supabaseAnonKey || 
      supabaseUrl.includes('your-project-id') || 
      supabaseAnonKey.includes('your-anon-key')) {
    throw new Error(
      '❌ Supabase 未配置!\n\n' +
      '请按以下步骤配置:\n' +
      '1. 访问 https://supabase.com/dashboard 创建项目\n' +
      '2. 在项目设置中找到 API 配置: https://supabase.com/dashboard/project/_/settings/api\n' +
      '3. 复制 "Project URL" 和 "anon public" key\n' +
      '4. 在项目根目录的 .env.local 文件中替换占位符\n' +
      '5. 重启开发服务器: npm run dev\n\n' +
      '当前配置状态:\n' +
      `- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || '未设置'}\n` +
      `- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '已设置但可能是占位符' : '未设置'}`
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
