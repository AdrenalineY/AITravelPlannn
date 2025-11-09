import { createClient } from '@/lib/supabase/client'
import { simpleDecrypt } from '@/lib/crypto'
import type { APIConfig, ConfigStatus, ConfigProgress, ValidationResult } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export class ConfigService {
  private supabase: SupabaseClient
  
  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient()
  }

  /**
   * 获取 Supabase 客户端 (确保使用最新的 session)
   */
  private getClient(): SupabaseClient {
    // 每次都创建新的客户端,确保获取最新的 session
    return createClient()
  }

  /**
   * 保存配置
   */
  async saveConfig(userId: string, config: APIConfig): Promise<void> {
    console.log('[ConfigService.saveConfig] ===== 开始保存配置 =====')
    console.log('[ConfigService.saveConfig] userId:', userId)
    
    // 使用新创建的客户端,确保获取最新的 session
    const client = this.getClient()
    
    // 简化认证检查 - 只记录日志,不阻止操作
    // 让数据库的 RLS 策略来处理权限验证
    try {
      const { data: { session } } = await client.auth.getSession()
      if (session) {
        console.log('[ConfigService] ✅ Session 有效, userId:', session.user.id)
        console.log('[ConfigService] Session 过期时间:', new Date(session.expires_at! * 1000))
      } else {
        console.warn('[ConfigService] ⚠️ getSession 返回 null, 将依赖 RLS 验证')
        
        // 尝试 getUser 获取更多信息
        const { data: { user } } = await client.auth.getUser()
        if (user) {
          console.log('[ConfigService] ✅ getUser 成功, userId:', user.id)
        } else {
          console.warn('[ConfigService] ⚠️ getUser 也返回 null')
        }
      }
    } catch (authError) {
      console.error('[ConfigService] ❌ 认证检查失败:', authError)
      // 不抛出错误,继续执行,让 RLS 处理
    }

    // 动态导入加密函数（避免服务器端执行时的问题）
    const { simpleEncrypt } = await import('@/lib/crypto')
    
    // 使用用户ID作为加密密钥，确保前后端一致
    const encryptedLLMKey = await simpleEncrypt(config.llm.apiKey, userId)
    const encryptedSpeechKey = await simpleEncrypt(config.speech.apiKey, userId)
    const encryptedMapWebServiceKey = await simpleEncrypt(config.map.webServiceKey, userId)
    const encryptedMapJsApiKey = await simpleEncrypt(config.map.jsApiKey, userId)
    const encryptedMapSecurityCode = config.map.securityCode 
      ? await simpleEncrypt(config.map.securityCode, userId)
      : null

    const configData = {
      user_id: userId,
      llm_provider: config.llm.provider,
      llm_api_key_encrypted: encryptedLLMKey,
      llm_base_url: config.llm.baseUrl,
      llm_model: config.llm.model,
      speech_provider: config.speech.provider,
      speech_api_key_encrypted: encryptedSpeechKey,
      speech_app_id: config.speech.appId,
      speech_api_secret: config.speech.apiSecret,
      map_provider: config.map.provider,
      map_web_service_key_encrypted: encryptedMapWebServiceKey,
      map_js_api_key_encrypted: encryptedMapJsApiKey,
      map_security_code_encrypted: encryptedMapSecurityCode,
      has_completed_setup: true,
      updated_at: new Date().toISOString(),
    }

    // 先检查记录是否存在 (使用 maybeSingle 避免 0 行错误)
    const { data: existing, error: selectError } = await client
      .from('user_configs')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()  // 使用 maybeSingle 代替 single,允许 0 行返回 null

    // 如果查询本身失败(不是没有数据),抛出错误
    if (selectError) {
      console.error('[ConfigService] 查询配置记录失败:', selectError)
      throw selectError
    }

    if (existing) {
      // 记录存在 - 使用 UPDATE
      console.log('[ConfigService] 记录已存在,使用 UPDATE')
      const { error } = await client
        .from('user_configs')
        .update(configData)
        .eq('user_id', userId)
      
      if (error) {
        console.error('[ConfigService] UPDATE 失败:', error)
        throw error
      }
    } else {
      // 记录不存在 - 使用 INSERT
      console.log('[ConfigService] 记录不存在,使用 INSERT')
      const { error } = await client
        .from('user_configs')
        .insert(configData)
      
      if (error) {
        console.error('[ConfigService] INSERT 失败:', error)
        console.error('[ConfigService] 当前 userId:', userId)
        console.error('[ConfigService] 错误详情:', JSON.stringify(error, null, 2))
        throw error
      }
    }
  }

  /**
   * 加载配置
   */
  async loadConfig(userId: string): Promise<APIConfig | null> {
    console.log('[ConfigService] 正在加载配置, userId:', userId)
    
    const { data, error } = await this.supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[ConfigService] 数据库查询错误:', error)
      return null
    }
    
    if (!data) {
      console.log('[ConfigService] 未找到配置数据')
      return null
    }

    console.log('[ConfigService] 找到配置记录, has_completed_setup:', data.has_completed_setup)

    try {
      // 使用用户ID作为解密密钥，确保前后端一致
      const llmApiKey = data.llm_api_key_encrypted
        ? await simpleDecrypt(data.llm_api_key_encrypted, userId)
        : ''
      const speechApiKey = data.speech_api_key_encrypted
        ? await simpleDecrypt(data.speech_api_key_encrypted, userId)
        : ''
      const mapWebServiceKey = data.map_web_service_key_encrypted
        ? await simpleDecrypt(data.map_web_service_key_encrypted, userId)
        : ''
      const mapJsApiKey = data.map_js_api_key_encrypted
        ? await simpleDecrypt(data.map_js_api_key_encrypted, userId)
        : ''
      const mapSecurityCode = data.map_security_code_encrypted
        ? await simpleDecrypt(data.map_security_code_encrypted, userId)
        : undefined

      console.log('[ConfigService] 配置解密成功, 密钥状态:', {
        hasLLMKey: !!llmApiKey,
        hasMapWebKey: !!mapWebServiceKey,
        hasMapJsKey: !!mapJsApiKey,
        hasSpeechKey: !!speechApiKey,
      })

      return {
        llm: {
          provider: data.llm_provider || 'aliyun',
          apiKey: llmApiKey,
          baseUrl: data.llm_base_url,
          model: data.llm_model,
        },
        speech: {
          provider: data.speech_provider || 'xunfei',
          apiKey: speechApiKey,
          appId: data.speech_app_id,
          apiSecret: data.speech_api_secret,
        },
        map: {
          provider: data.map_provider || 'amap',
          webServiceKey: mapWebServiceKey,
          jsApiKey: mapJsApiKey,
          securityCode: mapSecurityCode,
        },
      }
    } catch (error) {
      console.error('[ConfigService] 解密配置失败:', error)
      return null
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(config: APIConfig): Promise<ValidationResult> {
    const errors: Record<string, string> = {}
    const warnings: Record<string, string> = {}

    // 验证 LLM 配置
    if (!config.llm.apiKey) {
      errors.llm = 'LLM API 密钥不能为空'
    } else {
      const llmValid = await this.validateLLMKey(
        config.llm.provider, 
        config.llm.apiKey,
        config.llm.baseUrl,
        config.llm.model
      )
      if (!llmValid) {
        errors.llm = 'LLM API 密钥验证失败，请检查密钥、Base URL 和模型名称是否正确'
      }
    }

    // 验证语音配置
    if (!config.speech.apiKey) {
      warnings.speech = '语音 API 密钥为空，语音功能将不可用'
    } else {
      const speechValid = await this.validateSpeechKey(
        config.speech.provider,
        config.speech.apiKey,
        config.speech.appId,
        config.speech.apiSecret
      )
      if (!speechValid) {
        warnings.speech = '语音 API 密钥验证失败'
      }
    }

    // 验证地图配置
    if (!config.map.webServiceKey || !config.map.jsApiKey) {
      errors.map = '地图 API 密钥不完整，需要同时提供 Web服务 Key 和 JS API Key'
    } else {
      // 验证 Web服务 Key
      const webServiceValid = await this.validateMapKey(config.map.provider, config.map.webServiceKey)
      if (!webServiceValid) {
        errors.map = 'Web服务 API Key 验证失败，请检查密钥是否正确'
      }
      // 注意: JS API Key 的验证需要在前端地图加载时进行,这里无法直接验证
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
    }
  }

  /**
   * 验证 LLM API 密钥
   * 通过后端 API Route 代理验证,避免 CORS 问题
   */
  private async validateLLMKey(
    provider: string, 
    apiKey: string, 
    baseUrl?: string, 
    model?: string
  ): Promise<boolean> {
    try {
      // 调用后端 API Route 进行验证
      const response = await fetch('/api/validate/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl,
          model,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ LLM API 验证成功:', data.message)
        return true
      } else {
        console.error('❌ LLM API 验证失败:', data.error)
        return false
      }
    } catch (error) {
      console.error('LLM key validation error:', error)
      return false
    }
  }

  /**
   * 验证语音 API 密钥
   * 通过后端 API Route 代理验证
   */
  private async validateSpeechKey(
    provider: string, 
    apiKey: string,
    appId?: string,
    apiSecret?: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/validate/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey,
          appId,
          apiSecret,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ 语音 API 验证成功:', data.message)
        return true
      } else {
        console.warn('⚠️ 语音 API 验证失败:', data.error)
        return false
      }
    } catch (error) {
      console.error('Speech key validation error:', error)
      return false
    }
  }

  /**
   * 验证地图 API 密钥
   * 通过后端 API Route 代理验证
   */
  private async validateMapKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('/api/validate/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ 地图 API 验证成功:', data.message)
        return true
      } else {
        console.error('❌ 地图 API 验证失败:', data.error)
        return false
      }
    } catch (error) {
      console.error('Map key validation error:', error)
      return false
    }
  }

  /**
   * 检查配置完整性
   */
  async checkConfigCompleteness(userId: string): Promise<ConfigStatus> {
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
    const hasMapConfig = !!data.map_provider && 
                         !!data.map_web_service_key_encrypted && 
                         !!data.map_js_api_key_encrypted

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
   * 初始化新用户配置
   */
  async initializeNewUserConfig(userId: string): Promise<void> {
    const { error } = await this.supabase.from('user_configs').insert({
      user_id: userId,
      has_completed_setup: false,
    })

    if (error && error.code !== '23505') {
      // 23505 是唯一约束冲突，表示已存在
      throw error
    }
  }

  /**
   * 获取配置进度
   */
  async getConfigProgress(userId: string): Promise<ConfigProgress> {
    const status = await this.checkConfigCompleteness(userId)

    const steps = ['llm', 'speech', 'map']
    const completedSteps = steps.filter(
      (step) => !status.missingConfigs.includes(step)
    ).length

    let currentStep = 'llm'
    let nextStep: string | undefined = 'speech'

    if (status.hasLLMConfig && !status.hasSpeechConfig) {
      currentStep = 'speech'
      nextStep = 'map'
    } else if (status.hasSpeechConfig && !status.hasMapConfig) {
      currentStep = 'map'
      nextStep = undefined
    }

    return {
      totalSteps: 3,
      completedSteps,
      currentStep,
      nextStep,
      isComplete: status.isConfigComplete,
    }
  }

  /**
   * 标记配置完成
   */
  async markConfigComplete(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_configs')
      .update({ has_completed_setup: true })
      .eq('user_id', userId)

    if (error) throw error
  }
}

export const configService = new ConfigService()
