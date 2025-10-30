/**
 * 讯飞语音识别服务
 * 基于讯飞开放平台中英识别大模型 API
 * 文档: https://www.xfyun.cn/doc/spark/spark_zh_iat.html
 */

import CryptoJS from 'crypto-js'

interface VoiceConfig {
  appId: string
  apiKey: string
  apiSecret: string
}

interface TranscriptionResult {
  text: string
  confidence: number
  isComplete: boolean
}

// 第一帧消息格式
interface FirstFrameMessage {
  common: {
    app_id: string
  }
  business: {
    language: string
    domain: string
    accent: string
    dwa?: string
  }
  data: {
    status: number
    format: string
    audio: string
    encoding: string
  }
}

// 后续帧消息格式
interface ContinueFrameMessage {
  data: {
    status: number
    format: string
    audio: string
    encoding: string
  }
}

class VoiceService {
  private config: VoiceConfig | null = null
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording = false
  private onTranscriptionCallback: ((result: TranscriptionResult) => void) | null = null
  private transcriptionBuffer: string = ''
  private seq = 0

  /**
   * 设置语音配置
   */
  setConfig(config: VoiceConfig) {
    this.config = config
  }

  /**
   * 生成讯飞WebSocket鉴权URL
   */
  private generateAuthUrl(): string {
    if (!this.config) {
      throw new Error('语音配置未设置')
    }

    // 验证配置完整性
    if (!this.config.appId || !this.config.apiKey || !this.config.apiSecret) {
      console.error('❌ API配置不完整:')
      console.error('   APPID:', this.config.appId ? '已配置' : '❌ 未配置')
      console.error('   API Key:', this.config.apiKey ? '已配置' : '❌ 未配置')
      console.error('   API Secret:', this.config.apiSecret ? '已配置' : '❌ 未配置')
      throw new Error('API配置不完整，请在设置中完成配置')
    }

    console.log('🔐 开始生成鉴权URL...')

    const url = 'wss://iat-api.xfyun.cn/v2/iat'
    const host = 'iat-api.xfyun.cn'
    const date = new Date().toUTCString()
    const requestLine = 'GET /v2/iat HTTP/1.1'

    console.log('📅 Date:', date)

    // 拼接signature原始字段
    const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`
    console.log('📝 SignatureOrigin:', signatureOrigin.substring(0, 100))

    // 使用hmac-sha256算法结合apiSecret对signatureOrigin签名
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.config.apiSecret)
    const signature = CryptoJS.enc.Base64.stringify(signatureSha)
    console.log('🔑 Signature:', signature.substring(0, 20) + '...')

    // 拼接authorization_origin
    const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`

    // base64编码
    const authorization = btoa(authorizationOrigin)
    console.log('🎫 Authorization:', authorization.substring(0, 30) + '...')

    // 拼接完整URL
    const fullUrl = `${url}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`
    console.log('✅ 鉴权URL生成完成')
    
    return fullUrl
  }

  /**
   * 开始录音
   */
  async startRecording(onTranscription: (result: TranscriptionResult) => void): Promise<void> {
    // 如果正在录音，先停止
    if (this.isRecording) {
      console.log('⚠️  检测到正在录音，先停止之前的录音...')
      await this.stopRecording()
      // 等待清理完成
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    // 确保清理完成
    if (this.ws || this.audioContext) {
      console.log('🧹 清理残留资源...')
      this.cleanup()
    }

    if (!this.config) {
      throw new Error('请先配置语音识别API密钥')
    }

    this.onTranscriptionCallback = onTranscription
    this.transcriptionBuffer = ''
    this.seq = 0
    this.audioChunks = []

    let stream: MediaStream | null = null

    try {
      console.log('开始请求麦克风权限...')
      
      // 获取麦克风权限
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      console.log('✅ 麦克风权限获取成功')

      // 创建AudioContext用于音频处理
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(stream)
      
      // 创建ScriptProcessor用于实时获取PCM数据
      // bufferSize必须是2的幂次方,使用2048 (约128ms)
      const processor = this.audioContext.createScriptProcessor(2048, 1, 1)
      
      source.connect(processor)
      processor.connect(this.audioContext.destination)

      console.log('开始连接WebSocket...')
      
      // 连接WebSocket
      try {
        await this.connectWebSocket()
        console.log('✅ WebSocket连接成功,开始录音...')
      } catch (wsError: any) {
        console.error('❌ WebSocket连接失败:', wsError)
        // 清理已创建的音频资源
        processor.disconnect()
        source.disconnect()
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
        if (this.audioContext) {
          this.audioContext.close()
          this.audioContext = null
        }
        throw new Error(`语音识别服务连接失败: ${wsError.message || '请检查网络连接和API配置'}`)
      }

      // 监听音频数据
      processor.onaudioprocess = (e) => {
        if (!this.isRecording) {
          return
        }
        
        // 获取PCM数据
        const inputData = e.inputBuffer.getChannelData(0)
        const pcmInt16 = new Int16Array(inputData.length)
        
        for (let i = 0; i < inputData.length; i++) {
          // 转换为16位整数
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        
        // 发送音频数据
        this.sendAudioDataDirect(pcmInt16)
      }

      // 保存processor和stream引用以便后续清理
      ;(this.audioContext as any).scriptProcessor = processor
      ;(this.audioContext as any).mediaStream = stream

      this.isRecording = true
      console.log('✅ 录音已开始')
    } catch (error: any) {
      console.error('❌ 录音启动失败:', error)
      this.cleanup()
      
      // 根据错误类型提供更详细的错误信息
      if (error.name === 'NotAllowedError') {
        throw new Error('麦克风权限被拒绝，请允许浏览器访问麦克风')
      } else if (error.name === 'NotFoundError') {
        throw new Error('未找到麦克风设备，请连接麦克风后重试')
      } else if (error.message.includes('语音识别服务')) {
        // WebSocket连接错误，直接抛出
        throw error
      } else {
        throw new Error(`录音启动失败: ${error.message || '未知错误'}`)
      }
    }
  }

  /**
   * 停止录音
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      console.warn('⚠️  已经停止录音状态，跳过')
      return
    }

    console.log('停止录音...')
    // 立即设置状态，防止重复调用
    this.isRecording = false

    // 发送结束帧
    this.sendEndFrame()

    // 延迟清理资源，确保结束帧发送完成
    setTimeout(() => {
      this.cleanup()
    }, 500)
  }

  /**
   * 连接WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const authUrl = this.generateAuthUrl()
        console.log('正在连接WebSocket...')
        console.log('🔗 URL:', authUrl.substring(0, 60) + '...')
        console.log('🔑 APPID:', this.config!.appId)
        
        this.ws = new WebSocket(authUrl)

        // 设置连接超时
        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket连接超时')
            this.ws.close()
            reject(new Error('连接超时，请检查网络连接'))
          }
        }, 10000) // 10秒超时

        this.ws.onopen = () => {
          clearTimeout(timeout)
          console.log('✅ WebSocket连接成功')
          resolve()
        }

        this.ws.onmessage = (event) => {
          console.log('📥 收到消息:', event.data.substring(0, 200))
          this.handleWebSocketMessage(event.data)
        }

        this.ws.onerror = (error) => {
          clearTimeout(timeout)
          console.error('❌ WebSocket错误:', error)
          console.error('❌ 可能的原因:')
          console.error('   1. API密钥配置错误')
          console.error('   2. 网络连接问题')
          console.error('   3. 讯飞服务异常')
          reject(new Error('WebSocket连接失败，请检查API配置和网络连接'))
        }

        this.ws.onclose = (event) => {
          clearTimeout(timeout)
          console.log('🔌 WebSocket连接关闭, code:', event.code, 'reason:', event.reason)
          if (event.code !== 1000 && event.code !== 1005) {
            console.error('❌ 异常关闭码:', event.code)
            if (event.code === 1002) {
              console.error('   错误: 协议错误')
            } else if (event.code === 1003) {
              console.error('   错误: 不支持的数据类型')
            } else if (event.code === 1006) {
              console.error('   错误: 连接异常关闭（可能是网络问题或服务器拒绝）')
            } else if (event.code === 1007) {
              console.error('   错误: 数据格式错误')
            } else if (event.code === 1008) {
              console.error('   错误: 违反策略（可能是认证失败）')
            }
          }
        }
      } catch (error) {
        console.error('创建WebSocket失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 处理WebSocket消息
   */
  private handleWebSocketMessage(data: string) {
    try {
      const response = JSON.parse(data)
      console.log('解析响应:', response)
      
      if (response.code !== 0) {
        console.error('❌ 识别错误, code:', response.code, 'message:', response.message)
        if (this.onTranscriptionCallback) {
          this.onTranscriptionCallback({
            text: `错误: ${response.message}`,
            confidence: 0,
            isComplete: true,
          })
        }
        return
      }

      // 解析识别结果
      if (response.data && response.data.result) {
        const result = response.data.result
        console.log('识别结果:', result)
        
        // 处理动态修正
        if (result.pgs === 'rpl') {
          console.log('📝 动态修正, 需要替换的序号:', result.rg)
          // 清除被修正的结果
          if (result.rg) {
            result.rg.forEach((index: number) => {
              // 这里可以实现更精确的修正逻辑
            })
          }
        }
        
        // 拼接识别文本
        if (result.ws) {
          const words = result.ws.map((word: any) => {
            return word.cw.map((c: any) => c.w).join('')
          }).join('')
          
          console.log('识别文本:', words)
          this.transcriptionBuffer += words

          // 回调实时结果
          if (this.onTranscriptionCallback) {
            this.onTranscriptionCallback({
              text: this.transcriptionBuffer,
              confidence: 0.9,
              isComplete: response.data.status === 2,
            })
          }
          
          if (response.data.status === 2) {
            console.log('✅ 识别完成, 最终结果:', this.transcriptionBuffer)
          }
        }
      }
    } catch (error) {
      console.error('解析识别结果失败:', error, '原始数据:', data)
    }
  }

  /**
   * 直接发送PCM音频数据
   */
  private sendAudioDataDirect(pcmData: Int16Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️  WebSocket未连接,跳过数据发送')
      return
    }

    try {
      // 将Int16Array转为Base64
      const uint8Array = new Uint8Array(pcmData.buffer)
      const base64Audio = btoa(
        Array.from(uint8Array)
          .map((byte) => String.fromCharCode(byte))
          .join('')
      )

      // 构建消息
      if (this.seq === 0) {
        // 第一帧
        const message: FirstFrameMessage = {
          common: {
            app_id: this.config!.appId,
          },
          business: {
            language: 'zh_cn',
            domain: 'iat',
            accent: 'mandarin',
            dwa: 'wpgs', // 动态修正
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            audio: base64Audio,
            encoding: 'raw',
          },
        }
        console.log('📤 发送第一帧, 数据长度:', base64Audio.length)
        this.ws.send(JSON.stringify(message))
      } else {
        // 后续帧
        const message: ContinueFrameMessage = {
          data: {
            status: 1,
            format: 'audio/L16;rate=16000',
            audio: base64Audio,
            encoding: 'raw',
          },
        }
        if (this.seq % 50 === 0) {
          console.log(`📤 发送第 ${this.seq} 帧, 数据长度:`, base64Audio.length)
        }
        this.ws.send(JSON.stringify(message))
      }

      this.seq++
    } catch (error) {
      console.error('❌ 音频数据处理失败:', error)
    }
  }

  /**
   * 发送音频数据 (旧方法,保留用于兼容)
   */
  private async sendAudioData(audioBlob: Blob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      // 将WebM转为PCM
      const arrayBuffer = await audioBlob.arrayBuffer()
      
      // 解码音频数据
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer.slice(0))
      } catch (error) {
        console.warn('音频解码失败，跳过此帧:', error)
        return
      }
      
      // 获取PCM数据
      const pcmData = audioBuffer.getChannelData(0)
      const pcmInt16 = new Int16Array(pcmData.length)
      for (let i = 0; i < pcmData.length; i++) {
        pcmInt16[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768))
      }

      // Base64编码
      const uint8Array = new Uint8Array(pcmInt16.buffer)
      const base64Audio = btoa(
        Array.from(uint8Array)
          .map((byte) => String.fromCharCode(byte))
          .join('')
      )

      // 构建消息
      if (this.seq === 0) {
        // 第一帧
        const message: FirstFrameMessage = {
          common: {
            app_id: this.config!.appId,
          },
          business: {
            language: 'zh_cn',
            domain: 'iat',
            accent: 'mandarin',
            dwa: 'wpgs', // 动态修正
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            audio: base64Audio,
            encoding: 'raw',
          },
        }
        this.ws.send(JSON.stringify(message))
      } else {
        // 后续帧
        const message: ContinueFrameMessage = {
          data: {
            status: 1,
            format: 'audio/L16;rate=16000',
            audio: base64Audio,
            encoding: 'raw',
          },
        }
        this.ws.send(JSON.stringify(message))
      }

      this.seq++
    } catch (error) {
      console.error('音频数据处理失败:', error)
    }
  }

  /**
   * 发送结束帧
   */
  private sendEndFrame() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️  WebSocket未连接,无法发送结束帧')
      return
    }

    const message: ContinueFrameMessage = {
      data: {
        status: 2,
        format: 'audio/L16;rate=16000',
        audio: '',
        encoding: 'raw',
      },
    }

    console.log('📤 发送结束帧')
    this.ws.send(JSON.stringify(message))
  }

  /**
   * 清理资源
   */
  private cleanup() {
    console.log('🧹 清理资源...')
    
    if (this.audioContext) {
      // 停止MediaStream
      const stream = (this.audioContext as any).mediaStream
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          track.stop()
          console.log('🎤 麦克风轨道已停止')
        })
      }
      
      // 断开ScriptProcessor
      const processor = (this.audioContext as any).scriptProcessor
      if (processor) {
        processor.disconnect()
        processor.onaudioprocess = null
        console.log('🔌 音频处理器已断开')
      }
      
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
        console.log('🔌 WebSocket已关闭')
      }
      this.ws = null
    }

    this.audioChunks = []
    this.isRecording = false
    console.log('✅ 资源清理完成')
  }

  /**
   * 检查是否正在录音
   */
  getIsRecording(): boolean {
    return this.isRecording
  }
}

export const voiceService = new VoiceService()
