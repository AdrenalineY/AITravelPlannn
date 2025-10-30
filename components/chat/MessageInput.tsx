'use client'

import React, { useState } from 'react'
import { Input, Button, Space } from 'antd'
import { SendOutlined, AudioOutlined } from '@ant-design/icons'
import { VoiceRecorder } from '@/components/voice/VoiceRecorder'

const { TextArea } = Input

interface MessageInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = '输入您的旅行需求...',
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 或 Cmd+Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSend()
    }
  }

  const handleVoiceInput = () => {
    setShowVoiceRecorder(true)
  }

  const handleTranscriptComplete = (text: string) => {
    // 将识别结果填充到输入框
    setMessage(text)
    setShowVoiceRecorder(false)
  }

  return (
    <>
      <div className="p-4 border-t bg-white">
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            autoSize={{ minRows: 2, maxRows: 4 }}
            disabled={disabled}
          />
          <div className="flex flex-col gap-2">
            <Button
              type="default"
              icon={<AudioOutlined />}
              onClick={handleVoiceInput}
              disabled={disabled}
              title="语音输入"
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={disabled || !message.trim()}
              title="发送 (Ctrl+Enter)"
            />
          </div>
        </Space.Compact>
        <div className="text-xs text-gray-400 mt-2">
          按 Ctrl+Enter 发送消息 | 点击麦克风图标使用语音输入
        </div>
      </div>

      {/* 语音录制对话框 */}
      <VoiceRecorder
        visible={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onTranscriptComplete={handleTranscriptComplete}
      />
    </>
  )
}
