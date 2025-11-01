/**
 * ReAct Agent Service - 实现 Thought-Action-Observation 循环
 * 对应 Python 版本中的 TravelPlanningAgent 类
 */

import {
  AgentRun,
  AgentMessage,
  AgentToolCall,
  AgentAction,
  ItineraryCard,
  ChatMessage
} from '@/types'
import { aiService } from './aiService'
import { AgentTools } from './agentTools'
import { createClient } from '@/lib/supabase/client'

interface AgentContext {
  sessionId: string
  userId: string
  conversationHistory: Array<{ role: string; content: string }>
  userPreferences: Record<string, any>
  currentPlan?: ItineraryCard
}

export class ReactAgent {
  private messages: Array<{ role: string; content: string }> = []
  private context: AgentContext
  private agentRunId: string | null = null
  private turnCount: number = 0
  private supabase: any // Supabase 客户端（支持前端和后端）
  
  // System Prompt - 对应 Python 中的 system_prompt
  private readonly SYSTEM_PROMPT = `
你是一个专业的旅行规划AI助手。
你运行在: Thought → Action → PAUSE → Observation 的循环中
当你认为基于用户当前提供信息，你的旅行规划已经完整时，你输出 Answer
用 Thought 分析当前信息。使用 Action 运行您可用的操作之一，然后返回 PAUSE。Observation 是运行 Action 后的结果。

## 可用工具
1. calculate_distance:
   - 格式: calculate_distance: 起点, 终点, 交通方式
   - 用途: 计算两地距离、时间和交通费用
   - 示例: calculate_distance: 东京站, 浅草寺, driving

2. search_nearby:
   - 格式: search_nearby: 地点, 类别, 半径
   - 类别: attraction(景点)、restaurant(餐饮)、hotel(住宿)
   - 用途: 搜索附近的POI信息
   - 示例: search_nearby: 东京, attraction, 5000

3. estimate_cost:
   - 格式: estimate_cost: 项目类型, 详细信息(JSON格式)
   - 用途: 估算各项费用
   - 示例: estimate_cost: {"type":"住宿","location":"东京","nights":4,"level":"中等"}

## Thought 原则
1. 分析对话历史和当前需求
2. 识别缺失的关键信息
3. 考虑用户偏好和约束条件
4. 规划合理的行程逻辑

## Action 策略
- 当需要两处地点之间的交通行程信息时 - 使用calculate_distance
- 当需要一处地点附近的景点、餐饮、住宿信息时 - 使用search_nearby
- 当需要费用信息时 - 使用estimate_cost  

## 输出要求
最终Answer必须包含:
1. 完整的旅行计划(自然语言)
2. 明确的下一步问题引导用户提供更多细节

格式示例:
Answer:
[详细的旅行计划内容...]

为了完善您的行程，请告诉我：
1. 您的具体旅行日期是什么时候？
2. 有几位同行人员？
3. ...
`.trim()

  constructor(context: AgentContext, supabaseClient?: any) {
    this.context = context
    this.supabase = supabaseClient || createClient()
    this.messages.push({
      role: 'system',
      content: this.SYSTEM_PROMPT
    })
  }

  /**
   * 运行完整的 ReAct 循环
   * 对应 Python 版本的 __call__ 方法
   */
  async run(userMessage: string, maxTurns: number = 10): Promise<{
    success: boolean
    finalAnswer?: string
    planExtracted?: ItineraryCard
    error?: string
    agentRunId: string
    messages: AgentMessage[]
  }> {
    const agentMessages: AgentMessage[] = []

    try {
      // 创建 agent_run 记录
      const { data: agentRun, error: runError } = await this.supabase
        .from('agent_runs')
        .insert({
          session_id: this.context.sessionId,
          user_message: userMessage,
          context: {
            conversationHistory: this.context.conversationHistory,
            userPreferences: this.context.userPreferences,
            currentPlan: this.context.currentPlan
          },
          status: 'running',
          turn_count: 0
        })
        .select()
        .single()

      if (runError || !agentRun) {
        throw new Error('创建 Agent 运行记录失败')
      }

      this.agentRunId = agentRun.id

      // 构建上下文并添加到消息中
      const contextMessage = this.buildContext(userMessage)
      this.messages.push({
        role: 'user',
        content: contextMessage
      })

      // 主循环 - Thought → Action → Observation → Answer
      for (let turn = 0; turn < maxTurns; turn++) {
        this.turnCount = turn + 1
        console.log(`[ReactAgent] Turn ${this.turnCount}`)

        // 调用 LLM
        const result = await this.executeLLM()
        console.log(`[ReactAgent] LLM Response:\n${result}`)

        // 记录消息(后续会根据类型分类)
        await this.saveMessage('thought', result, turn + 1)

        // 解析 Action
        const action = this.parseAction(result)

        if (action) {
          // 有 Action - 执行工具调用
          console.log(`[ReactAgent] Action: ${action.action}`)
          console.log(`[ReactAgent] Input: ${action.actionInput}`)

          const startTime = Date.now()
          const toolResult = await AgentTools.executeAction(action.action, action.actionInput)
          const executionTime = Date.now() - startTime

          console.log(`[ReactAgent] Observation: ${toolResult.observation}`)

          // 保存工具调用记录
          await this.supabase.from('agent_tool_calls').insert({
            agent_run_id: this.agentRunId,
            turn_number: turn + 1,
            tool_name: action.action,
            tool_input: action.actionInput,
            tool_output: JSON.stringify(toolResult.payload),
            observation: toolResult.observation,
            execution_time_ms: executionTime
          })

          // 保存 observation 消息
          await this.saveMessage('observation', toolResult.observation, turn + 1)

          // 将观察结果反馈给 LLM
          this.messages.push({
            role: 'user',
            content: `Observation: ${toolResult.observation}`
          })
        } else {
          // 没有 Action - 输出最终答案
          const finalAnswer = this.extractFinalAnswer(result)
          console.log(`[ReactAgent] Final Answer extracted`)

          // 保存 answer 消息
          await this.saveMessage('answer', finalAnswer, turn + 1)

          // 提取结构化计划
          const planExtracted = await this.extractPlanStructure(finalAnswer)

          // 更新 agent_run 状态
          await this.supabase
            .from('agent_runs')
            .update({
              final_answer: finalAnswer,
              plan_extracted: planExtracted,
              status: 'completed',
              turn_count: turn + 1,
              completed_at: new Date().toISOString()
            })
            .eq('id', this.agentRunId)

          // 获取所有消息
          const { data: messages } = await this.supabase
            .from('agent_messages')
            .select('*')
            .eq('agent_run_id', this.agentRunId)
            .order('turn_number', { ascending: true })

          return {
            success: true,
            finalAnswer,
            planExtracted: planExtracted || undefined,
            agentRunId: this.agentRunId!,
            messages: messages || []
          }
        }
      }

      // 超过最大轮次
      await this.supabase
        .from('agent_runs')
        .update({
          status: 'error',
          error_message: '规划过程超时',
          turn_count: maxTurns,
          completed_at: new Date().toISOString()
        })
        .eq('id', this.agentRunId)

      return {
        success: false,
        error: '抱歉，规划过程超时，请重新尝试。',
        agentRunId: this.agentRunId || '',
        messages: agentMessages
      }

    } catch (error: any) {
      console.error('[ReactAgent] Error:', error)

      if (this.agentRunId) {
        await this.supabase
          .from('agent_runs')
          .update({
            status: 'error',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', this.agentRunId)
      }

      return {
        success: false,
        error: error.message || 'Agent 运行出错',
        agentRunId: this.agentRunId || '',
        messages: agentMessages
      }
    }
  }

  /**
   * 构建包含历史对话和偏好的上下文
   * 对应 Python 版本的 _build_context
   */
  private buildContext(currentMessage: string): string {
    const historyFormatted = this.formatConversationHistory()
    const preferencesFormatted = this.formatUserPreferences()
    const planFormatted = this.context.currentPlan
      ? JSON.stringify(this.context.currentPlan, null, 2)
      : '暂无计划'

    return `
当前用户输入: ${currentMessage}

对话历史:
${historyFormatted}

用户偏好信息:
${preferencesFormatted}

当前旅行计划状态:
${planFormatted}
`.trim()
  }

  /**
   * 格式化对话历史
   * 对应 Python 版本的 _format_conversation_history
   */
  private formatConversationHistory(): string {
    if (!this.context.conversationHistory || this.context.conversationHistory.length === 0) {
      return '无历史对话'
    }

    // 只保留最近5轮对话
    const recentHistory = this.context.conversationHistory.slice(-5)
    return recentHistory
      .map(msg => {
        const role = msg.role === 'user' ? '用户' : '助手'
        return `${role}: ${msg.content}`
      })
      .join('\n')
  }

  /**
   * 格式化用户偏好信息
   * 对应 Python 版本的 _format_user_preferences
   */
  private formatUserPreferences(): string {
    if (!this.context.userPreferences || Object.keys(this.context.userPreferences).length === 0) {
      return '无用户偏好信息'
    }
    return JSON.stringify(this.context.userPreferences, null, 2)
  }

  /**
   * 执行 LLM 调用
   * 对应 Python 版本的 _execute_llm
   */
  private async executeLLM(): Promise<string> {
    try {
      const response = await aiService.chat(this.messages)
      this.messages.push({
        role: 'assistant',
        content: response
      })
      return response
    } catch (error: any) {
      throw new Error(`LLM调用错误: ${error.message}`)
    }
  }

  /**
   * 解析 Action 指令
   * 对应 Python 版本的 _parse_action
   */
  private parseAction(result: string): AgentAction | null {
    const actionRegex = /^Action:\s*(\w+):\s*(.*)$/m
    const match = result.match(actionRegex)

    if (match) {
      return {
        action: match[1],
        actionInput: match[2].trim()
      }
    }

    return null
  }

  /**
   * 提取最终答案
   * 对应 Python 版本的 _extract_final_answer
   */
  private extractFinalAnswer(result: string): string {
    const answerRegex = /Answer:\s*([\s\S]*)/
    const match = result.match(answerRegex)

    if (match && match[1].trim()) {
      return match[1].trim()
    }

    // 如果没有明确的 Answer 标记,返回整个结果
    return result
  }

  /**
   * 提取结构化计划
   * 对应 Python 版本的 _save_plan_structure
   */
  private async extractPlanStructure(naturalLanguagePlan: string): Promise<ItineraryCard | null> {
    try {
      // 从上下文中提取已知信息
      const contextInfo = this.extractContextInfo(naturalLanguagePlan)

      const plan = await AgentTools.extractPlanStructure(naturalLanguagePlan, contextInfo)

      if (plan) {
        console.log('[ReactAgent] Plan structure extracted successfully')
        return plan
      }

      return null
    } catch (error) {
      console.error('[ReactAgent] Failed to extract plan structure:', error)
      return null
    }
  }

  /**
   * 从消息中提取上下文信息
   */
  private extractContextInfo(text: string): {
    destination?: string
    travelers?: number
    budget?: number
    startDate?: string
    endDate?: string
  } {
    const info: any = {}

    // 简单的正则提取(可以优化)
    const destinationMatch = text.match(/(?:去|前往|目的地[是为]?)\s*([^\s，。,]+)/i)
    if (destinationMatch) info.destination = destinationMatch[1]

    const travelersMatch = text.match(/(\d+)\s*(?:人|位|个人)/i)
    if (travelersMatch) info.travelers = parseInt(travelersMatch[1])

    const budgetMatch = text.match(/预算[约大概]?\s*(\d+)\s*[元万]/i)
    if (budgetMatch) {
      info.budget = budgetMatch[0].includes('万') 
        ? parseInt(budgetMatch[1]) * 10000 
        : parseInt(budgetMatch[1])
    }

    // 从用户偏好中获取
    if (this.context.userPreferences) {
      if (!info.destination && this.context.userPreferences.destination) {
        info.destination = this.context.userPreferences.destination
      }
      if (!info.travelers && this.context.userPreferences.travelers) {
        info.travelers = this.context.userPreferences.travelers
      }
      if (!info.budget && this.context.userPreferences.budget) {
        info.budget = this.context.userPreferences.budget
      }
    }

    return info
  }

  /**
   * 保存消息到数据库
   */
  private async saveMessage(
    messageType: 'thought' | 'action' | 'observation' | 'answer',
    content: string,
    turnNumber: number
  ): Promise<void> {
    if (!this.agentRunId) return

    await this.supabase.from('agent_messages').insert({
      agent_run_id: this.agentRunId,
      turn_number: turnNumber,
      message_type: messageType,
      content,
      metadata: {}
    })
  }
}

/**
 * 创建 Agent 实例的工厂函数
 */
export async function createReactAgent(
  sessionId: string,
  userId: string,
  supabaseClient?: any // 可选的 Supabase 客户端（用于后端）
): Promise<ReactAgent> {
  const supabase = supabaseClient || createClient()

  console.log('[ReactAgent] 创建 Agent, sessionId:', sessionId, 'userId:', userId)

  // 获取会话信息
  const { data: session, error: sessionError } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) {
    console.error('[ReactAgent] 查询会话失败:', sessionError)
    throw new Error(`会话查询失败: ${sessionError.message}`)
  }

  if (!session) {
    console.error('[ReactAgent] 会话不存在, sessionId:', sessionId)
    throw new Error('会话不存在')
  }

  console.log('[ReactAgent] 会话查询成功:', session.id)

  // 获取对话历史(从 agent_runs 和 agent_messages 重建)
  const { data: previousRuns } = await supabase
    .from('agent_runs')
    .select('user_message, final_answer')
    .eq('session_id', sessionId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  const conversationHistory: Array<{ role: string; content: string }> = []
  if (previousRuns) {
    previousRuns.forEach((run: any) => {
      conversationHistory.push({
        role: 'user',
        content: run.user_message
      })
      if (run.final_answer) {
        conversationHistory.push({
          role: 'assistant',
          content: run.final_answer
        })
      }
    })
  }

  // 获取当前计划
  let currentPlan: ItineraryCard | undefined
  if (session.itinerary_id) {
    const { data: itinerary } = await supabase
      .from('itineraries')
      .select('*')
      .eq('id', session.itinerary_id)
      .single()

    if (itinerary) {
      currentPlan = itinerary as any // 需要转换
    }
  }

  const context: AgentContext = {
    sessionId,
    userId,
    conversationHistory,
    userPreferences: session.user_preferences || {},
    currentPlan
  }

  console.log('[ReactAgent] Agent 创建完成')
  return new ReactAgent(context, supabase)
}

export const reactAgentService = {
  createAgent: createReactAgent
}
