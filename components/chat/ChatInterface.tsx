'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, message as antMessage, Spin } from 'antd'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { agentServiceClient } from '@/services/agentServiceClient'
import type { ItineraryCard } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  type?: 'thought' | 'action' | 'observation' | 'answer'
}

interface ChatInterfaceProps {
  sessionId: string | null
  onItineraryUpdate?: (itinerary: Partial<ItineraryCard>) => void
  onSessionCreated?: (sessionId: string) => void
  height?: string | number
}

export function ChatInterface({
  sessionId,
  onItineraryUpdate,
  onSessionCreated,
  height = '100%',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const currentSessionId = useRef<string | null>(sessionId)

  // 加载历史消息
  useEffect(() => {
    if (sessionId) {
      loadHistoryMessages(sessionId)
    }
  }, [sessionId])

  const loadHistoryMessages = async (sid: string) => {
    try {
      setLoading(true)
      // TODO: 从后端加载历史消息
      console.log('[ChatInterface] 加载历史消息:', sid)
      // 这里可以调用 API 获取历史消息
      setLoading(false)
    } catch (error) {
      console.error('[ChatInterface] 加载历史消息失败:', error)
      setLoading(false)
    }
  }

  const handleSendMessage = useCallback(async (content: string) => {
    try {
      setGenerating(true)

      // 添加用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, userMessage])

      // 调用 Agent API
      const result = await agentServiceClient.runAgent({
        message: content,
        sessionId: currentSessionId.current || undefined,
        maxTurns: 10,
      })

      // 更新会话 ID
      if (result.sessionId && !currentSessionId.current) {
        currentSessionId.current = result.sessionId
        onSessionCreated?.(result.sessionId)
      }

      // 添加 Agent 思考过程消息
      if (result.messages && result.messages.length > 0) {
        const newMessages: Message[] = result.messages.map((msg, idx) => ({
          id: `${Date.now()}-${idx}`,
          role: 'assistant',
          content: msg.content,
          timestamp: new Date(msg.createdAt || Date.now()),
          type: msg.messageType as any,
        }))
        setMessages(prev => [...prev, ...newMessages])
      }

      // 添加最终答案
      if (result.finalAnswer) {
        const assistantMessage: Message = {
          id: `${Date.now()}-final`,
          role: 'assistant',
          content: result.finalAnswer,
          timestamp: new Date(),
          type: 'answer',
        }
        setMessages(prev => [...prev, assistantMessage])
      }

      // 如果生成了行程,通知父组件
      if (result.planExtracted) {
        onItineraryUpdate?.(result.planExtracted)
        antMessage.success('行程已更新')
      }

      setGenerating(false)
    } catch (error) {
      console.error('[ChatInterface] 发送消息失败:', error)
      antMessage.error('发送失败,请重试')
      setGenerating(false)
    }
  }, [onItineraryUpdate, onSessionCreated])

  const handleVoiceInput = useCallback((transcript: string) => {
    handleSendMessage(transcript)
  }, [handleSendMessage])

  if (loading) {
    return (
      <Card style={{ height }}>
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Spin tip="加载对话历史..." />
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="AI 助手"
      size="small"
      style={{ height, display: 'flex', flexDirection: 'column' }}
      bodyStyle={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <MessageList messages={messages.map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString()
        }))} />
      </div>

      {/* 输入框 */}
      <div style={{
        borderTop: '1px solid #f0f0f0',
        padding: 16,
      }}>
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={generating}
          placeholder={generating ? 'AI 正在思考...' : '描述您的旅行需求...'}
        />
      </div>
    </Card>
  )
}
