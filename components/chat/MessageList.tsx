'use client'

import React, { useRef, useEffect } from 'react'
import { List, Avatar, Typography, Tag } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import type { ChatMessage } from '@/types'

const { Text, Paragraph } = Typography

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新消息
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <RobotOutlined style={{ fontSize: 64, marginBottom: 16 }} />
          <p>开始您的旅行规划之旅吧!</p>
          <p className="text-sm mt-2">试着告诉我您的旅行需求</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex items-start gap-3 max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* 头像 */}
              <Avatar
                icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                style={{
                  backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a',
                }}
              />

              {/* 消息内容 */}
              <div
                className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <Paragraph
                  className={`mb-0 ${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {message.content}
                </Paragraph>

                {/* 时间戳 */}
                <Text
                  type="secondary"
                  className={`text-xs mt-2 block ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
