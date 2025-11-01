/**
 * Agent Service Client - 前端调用 Agent API 的客户端封装
 */

import type { ConversationSession, AgentMessage, ItineraryCard } from '@/types'

interface AgentRunRequest {
  sessionId?: string
  message: string
  maxTurns?: number
}

interface AgentRunResponse {
  success: boolean
  sessionId: string
  agentRunId: string
  finalAnswer?: string
  planExtracted?: ItineraryCard
  itineraryId?: string
  messages: AgentMessage[]
  error?: string
}

interface AgentRunStatusResponse {
  agentRun: {
    id: string
    sessionId: string
    userMessage: string
    finalAnswer?: string
    planExtracted?: ItineraryCard
    status: 'running' | 'completed' | 'error'
    errorMessage?: string
    turnCount: number
    createdAt: string
    completedAt?: string
  }
  messages: AgentMessage[]
  toolCalls: Array<{
    id: string
    agentRunId: string
    turnNumber: number
    toolName: string
    toolInput: string
    toolOutput?: string
    observation?: string
    executionTimeMs?: number
    createdAt: string
  }>
}

export class AgentServiceClient {
  /**
   * 运行 Agent
   */
  static async runAgent(request: AgentRunRequest): Promise<AgentRunResponse> {
    const response = await fetch('/api/agent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Agent 运行失败')
    }

    return response.json()
  }

  /**
   * 获取 Agent 运行状态
   */
  static async getAgentRunStatus(agentRunId: string): Promise<AgentRunStatusResponse> {
    const response = await fetch(`/api/agent/run?agentRunId=${agentRunId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '获取 Agent 状态失败')
    }

    return response.json()
  }

  /**
   * 创建新会话
   */
  static async createSession(title?: string, userPreferences?: Record<string, any>): Promise<ConversationSession> {
    const response = await fetch('/api/agent/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, userPreferences }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '创建会话失败')
    }

    const data = await response.json()
    return data.session
  }

  /**
   * 获取会话列表
   */
  static async getSessionList(): Promise<ConversationSession[]> {
    const response = await fetch('/api/agent/session')

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '获取会话列表失败')
    }

    const data = await response.json()
    return data.sessions
  }

  /**
   * 获取单个会话
   */
  static async getSession(sessionId: string): Promise<ConversationSession> {
    const response = await fetch(`/api/agent/session?sessionId=${sessionId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '获取会话失败')
    }

    const data = await response.json()
    return data.session
  }

  /**
   * 更新会话
   */
  static async updateSession(
    sessionId: string,
    updates: {
      title?: string
      userPreferences?: Record<string, any>
      isActive?: boolean
    }
  ): Promise<ConversationSession> {
    const response = await fetch('/api/agent/session', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, ...updates }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '更新会话失败')
    }

    const data = await response.json()
    return data.session
  }

  /**
   * 删除会话
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`/api/agent/session?sessionId=${sessionId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '删除会话失败')
    }
  }
}

export const agentServiceClient = AgentServiceClient
