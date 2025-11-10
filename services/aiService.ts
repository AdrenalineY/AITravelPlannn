import type { Itinerary, TravelRequirements, ChatMessage, ChatContext, DayPlan } from '@/types'

interface LLMConfig {
  provider: 'aliyun' | 'openai' | 'baidu'
  apiKey: string
  baseUrl?: string
  model?: string
}

interface AliyunChatResponse {
  output: {
    text: string
    finish_reason: string
  }
  usage: {
    total_tokens: number
  }
}

class AIService {
  private config: LLMConfig | null = null

  setConfig(config: LLMConfig) {
    this.config = config
  }

  /**
   * 生成行程规划
   */
  async generateItinerary(requirements: TravelRequirements): Promise<Itinerary> {
    if (!this.config) {
      throw new Error('LLM API 未配置')
    }

    const prompt = this.buildItineraryPrompt(requirements)
    const response = await this.chatCompletion([
      { role: 'system', content: '你是一个专业的旅行规划助手,擅长根据用户需求制定详细的旅行行程。' },
      { role: 'user', content: prompt },
    ])

    return this.parseItineraryResponse(response, requirements)
  }

  /**
   * 优化行程
   */
  async optimizeItinerary(itinerary: Itinerary, feedback: string): Promise<Itinerary> {
    if (!this.config) {
      throw new Error('LLM API 未配置')
    }

    const prompt = `
当前行程:
${JSON.stringify(itinerary, null, 2)}

用户反馈: ${feedback}

请根据用户反馈优化行程,返回完整的优化后的行程 JSON。
`

    const response = await this.chatCompletion([
      { role: 'system', content: '你是一个专业的旅行规划助手。' },
      { role: 'user', content: prompt },
    ])

    return this.parseItineraryResponse(response, {
      destination: itinerary.destination,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      travelers: itinerary.travelers,
      budget: itinerary.budget,
    })
  }

  /**
   * AI 对话
   */
  async chatWithAI(message: string, context: ChatContext): Promise<string> {
    if (!this.config) {
      throw new Error('LLM API 未配置')
    }

    const messages = [
      {
        role: 'system' as const,
        content: '你是一个友好的旅行规划助手,可以帮助用户制定行程、回答旅行问题、提供建议。',
      },
      ...context.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ]

    return await this.chatCompletion(messages)
  }

  /**
   * 调用大语言模型 API
   */
  private async chatCompletion(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (!this.config) {
      throw new Error('LLM API 未配置')
    }

    try {
      if (this.config.provider === 'aliyun') {
        return await this.callAliyunAPI(messages)
      } else if (this.config.provider === 'openai') {
        return await this.callOpenAIAPI(messages)
      } else {
        throw new Error(`不支持的 LLM 提供商: ${this.config.provider}`)
      }
    } catch (error) {
      console.error('LLM API 调用错误:', error)
      throw error
    }
  }

  /**
   * 调用阿里云百炼 API (OpenAI 兼容模式)
   */
  private async callAliyunAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
    const url = this.config?.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    const model = this.config?.model || 'qwen-plus'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config?.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`阿里云 API 调用失败: ${error}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAIAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
    const url = this.config?.baseUrl || 'https://api.openai.com/v1/chat/completions'
    const model = this.config?.model || 'gpt-4'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config?.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API 调用失败: ${error}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  /**
   * 构建行程生成 Prompt
   */
  private buildItineraryPrompt(requirements: TravelRequirements): string {
    const { destination, startDate, endDate, travelers, budget, preferences, additionalNotes } = requirements

    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1

    return `
请为我制定一份详细的旅行行程:

目的地: ${destination}
出发日期: ${startDate}
返回日期: ${endDate}
天数: ${days} 天
旅行人数: ${travelers} 人
${budget ? `预算: ${budget} 元` : ''}
${preferences?.travelStyle ? `旅行风格: ${preferences.travelStyle}` : ''}
${preferences?.companions ? `同行人: ${preferences.companions}` : ''}
${preferences?.interestTags?.length ? `兴趣标签: ${preferences.interestTags.join(', ')}` : ''}
${additionalNotes ? `其他要求: ${additionalNotes}` : ''}

请返回 JSON 格式的行程规划,包含每天的活动安排。格式如下:
{
  "title": "行程标题",
  "summary": "行程概述",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "summary": "当天概述",
      "activities": [
        {
          "time": "HH:MM",
          "poiName": "景点名称",
          "address": "具体地址",
          "notes": "活动说明",
          "cost": 100
        }
      ],
      "totalCost": 500
    }
  ]
}
`
  }

  /**
   * 解析 AI 返回的行程数据
   */
  private parseItineraryResponse(response: string, requirements: TravelRequirements): Itinerary {
    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('无法解析 AI 返回的行程数据')
      }

      const data = JSON.parse(jsonMatch[0])

      // 构建完整的行程对象
      const itinerary: Itinerary = {
        id: `itinerary-${Date.now()}`,
        userId: '', // 将在调用处填充
        title: data.title || `${requirements.destination}旅行计划`,
        destination: requirements.destination,
        startDate: requirements.startDate,
        endDate: requirements.endDate,
        travelers: requirements.travelers,
        budget: requirements.budget || 0,
        days: data.days.map((day: any) => ({
          id: `day-${Date.now()}-${Math.random()}`,
          date: day.date,
          summary: day.summary || '',
          totalCost: day.totalCost || 0,
          activities: (day.activities || []).map((act: any, index: number) => ({
            id: `activity-${Date.now()}-${index}`,
            order: index,
            time: act.time,
            poiName: act.poiName,
            address: act.address || '',
            notes: act.notes || '',
            cost: act.cost || 0,
          })),
          transportation: [],
        })),
        preferences: requirements.preferences || { interestTags: [] },
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      return itinerary
    } catch (error) {
      console.error('解析行程响应错误:', error)
      throw new Error('行程数据解析失败,请重试')
    }
  }

  /**
   * 公开的对话补全方法 (用于 Agent 等外部调用)
   */
  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    return this.chatCompletion(messages)
  }
}

export const aiService = new AIService()
