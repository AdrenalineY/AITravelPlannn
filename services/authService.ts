import { createClient } from '@/lib/supabase/client'
import type { User, UserProfile, ConfigStatus } from '@/types'

export class AuthService {
  private supabase = createClient()

  /**
   * 用户登录
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    
    // 获取用户配置状态
    const configStatus = await this.checkUserConfigStatus(data.user.id)
    
    return {
      user: this.mapSupabaseUser(data.user, configStatus),
      session: data.session,
    }
  }

  /**
   * 用户注册
   */
  async signUp(email: string, password: string, profile: UserProfile) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: profile.displayName,
          avatar: profile.avatar,
          locale: profile.locale || 'zh-CN',
          currency: profile.currency || 'CNY',
        },
      },
    })

    if (error) throw error
    if (!data.user) throw new Error('注册失败')

    // 创建用户配置记录
    await this.supabase.from('user_configs').insert({
      user_id: data.user.id,
      has_completed_setup: false,
    })

    return {
      user: this.mapSupabaseUser(data.user, {
        hasLLMConfig: false,
        hasSpeechConfig: false,
        hasMapConfig: false,
        isConfigComplete: false,
        missingConfigs: ['llm', 'speech', 'map'],
      }),
      session: data.session,
    }
  }

  /**
   * 用户登出
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    if (error) throw error
  }

  /**
   * 重置密码
   */
  async resetPassword(email: string) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser()

    if (!user) return null

    const configStatus = await this.checkUserConfigStatus(user.id)
    return this.mapSupabaseUser(user, configStatus)
  }

  /**
   * 检查用户配置状态
   */
  async checkUserConfigStatus(userId: string): Promise<ConfigStatus> {
    const { data, error } = await this.supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return {
        hasLLMConfig: false,
        hasSpeechConfig: false,
        hasMapConfig: false,
        isConfigComplete: false,
        missingConfigs: ['llm', 'speech', 'map'],
      }
    }

    const hasLLMConfig = !!data.llm_provider && !!data.llm_api_key_encrypted
    const hasSpeechConfig = !!data.speech_provider && !!data.speech_api_key_encrypted
    const hasMapConfig = !!data.map_provider && !!data.map_api_key

    const missingConfigs: string[] = []
    if (!hasLLMConfig) missingConfigs.push('llm')
    if (!hasSpeechConfig) missingConfigs.push('speech')
    if (!hasMapConfig) missingConfigs.push('map')

    return {
      hasLLMConfig,
      hasSpeechConfig,
      hasMapConfig,
      isConfigComplete: data.has_completed_setup || false,
      missingConfigs,
    }
  }

  /**
   * 确定登录后重定向路径
   */
  async redirectAfterAuth(user: User): Promise<string> {
    // 新用户或配置未完成 -> 配置页面
    if (user.isNewUser || !user.configStatus?.isConfigComplete) {
      return '/setup/api-config'
    }

    // 配置完成 -> 主界面
    return '/dashboard'
  }

  /**
   * 映射 Supabase 用户到应用用户类型
   */
  private mapSupabaseUser(supabaseUser: any, configStatus: ConfigStatus): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      displayName: supabaseUser.user_metadata?.display_name,
      avatar: supabaseUser.user_metadata?.avatar,
      locale: supabaseUser.user_metadata?.locale || 'zh-CN',
      currency: supabaseUser.user_metadata?.currency || 'CNY',
      isNewUser: !configStatus.isConfigComplete,
      lastLoginAt: supabaseUser.last_sign_in_at || new Date().toISOString(),
      createdAt: supabaseUser.created_at,
      configStatus,
    }
  }
}

export const authService = new AuthService()
