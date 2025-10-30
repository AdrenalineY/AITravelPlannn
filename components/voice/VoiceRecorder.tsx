'use client'

import React, { useEffect, useState } from 'react'
import { Modal, Button, Progress, Alert, Space } from 'antd'
import { AudioOutlined, StopOutlined, LoadingOutlined } from '@ant-design/icons'
import { voiceService } from '@/services/voiceService'
import { useVoiceStore } from '@/store/voiceStore'
import { useConfigStore } from '@/store/configStore'

interface VoiceRecorderProps {
  visible: boolean
  onClose: () => void
  onTranscriptComplete: (text: string) => void
}

export function VoiceRecorder({ visible, onClose, onTranscriptComplete }: VoiceRecorderProps) {
  const { config } = useConfigStore()
  const {
    isRecording,
    transcript,
    isProcessing,
    error,
    setIsRecording,
    setTranscript,
    setIsProcessing,
    setError,
    reset,
  } = useVoiceStore()

  const [recordingTime, setRecordingTime] = useState(0)
  const [maxRecordingTime] = useState(60) // 最大录音时长60秒

  // 录音计时器
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= maxRecordingTime) {
            handleStopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } else {
      setRecordingTime(0)
    }
    return () => clearInterval(timer)
  }, [isRecording, maxRecordingTime])

  // 开始录音
  const handleStartRecording = async () => {
    // 检查配置
    if (!config?.speech?.appId || !config?.speech?.apiKey || !config?.speech?.apiSecret) {
      setError('请先在设置中配置语音识别API密钥')
      return
    }

    try {
      setError(null)
      setTranscript('')
      setIsProcessing(true)

      // 设置语音服务配置
      voiceService.setConfig({
        appId: config.speech.appId,
        apiKey: config.speech.apiKey,
        apiSecret: config.speech.apiSecret,
      })

      // 开始录音
      await voiceService.startRecording((result) => {
        // 实时更新转写结果
        setTranscript(result.text)
        
        if (result.isComplete) {
          setIsRecording(false)
          setIsProcessing(false)
        }
      })

      setIsRecording(true)
      setIsProcessing(false)
    } catch (error: any) {
      console.error('录音启动失败:', error)
      setError(error.message || '录音启动失败，请检查麦克风权限')
      setIsProcessing(false)
    }
  }

  // 停止录音
  const handleStopRecording = async () => {
    try {
      setIsProcessing(true)
      await voiceService.stopRecording()
      setIsRecording(false)
      
      // 等待识别完成
      setTimeout(() => {
        setIsProcessing(false)
      }, 1000)
    } catch (error: any) {
      console.error('停止录音失败:', error)
      setError(error.message || '停止录音失败')
      setIsProcessing(false)
    }
  }

  // 确认使用识别结果
  const handleConfirm = () => {
    if (transcript.trim()) {
      onTranscriptComplete(transcript.trim())
    }
    handleClose()
  }

  // 关闭对话框
  const handleClose = () => {
    if (isRecording) {
      handleStopRecording()
    }
    reset()
    onClose()
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Modal
      title="语音输入"
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={!transcript.trim() || isRecording || isProcessing}
        >
          使用该文本
        </Button>,
      ]}
      width={500}
      maskClosable={false}
    >
      <div className="space-y-4">
        {/* 错误提示 */}
        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            closable
            onClose={() => setError(null)}
          />
        )}

        {/* 录音控制 */}
        <div className="flex flex-col items-center justify-center py-8">
          {!isRecording && !isProcessing ? (
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<AudioOutlined style={{ fontSize: '32px' }} />}
              onClick={handleStartRecording}
              style={{ width: '80px', height: '80px' }}
            />
          ) : (
            <Button
              type="primary"
              danger
              shape="circle"
              size="large"
              icon={
                isProcessing ? (
                  <LoadingOutlined style={{ fontSize: '32px' }} />
                ) : (
                  <StopOutlined style={{ fontSize: '32px' }} />
                )
              }
              onClick={handleStopRecording}
              disabled={isProcessing}
              style={{ width: '80px', height: '80px' }}
            />
          )}

          <div className="mt-4 text-center">
            {isRecording && (
              <div className="space-y-2">
                <div className="text-lg font-semibold text-red-600 animate-pulse">
                  录音中...
                </div>
                <div className="text-2xl font-mono">{formatTime(recordingTime)}</div>
                <Progress
                  percent={(recordingTime / maxRecordingTime) * 100}
                  showInfo={false}
                  status={recordingTime >= maxRecordingTime ? 'exception' : 'active'}
                />
              </div>
            )}
            {isProcessing && !isRecording && (
              <div className="text-lg text-blue-600">正在处理...</div>
            )}
            {!isRecording && !isProcessing && (
              <div className="text-gray-500">点击按钮开始录音</div>
            )}
          </div>
        </div>

        {/* 识别结果 */}
        {transcript && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">识别结果：</div>
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200 min-h-[80px]">
              <p className="text-base whitespace-pre-wrap">{transcript}</p>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              您可以在输入框中继续编辑识别结果
            </div>
          </div>
        )}

        {/* 使用提示 */}
        {!transcript && !isRecording && !isProcessing && (
          <div className="text-xs text-gray-500 space-y-1">
            <p>• 最长支持60秒录音</p>
            <p>• 请在安静环境下录音以获得最佳识别效果</p>
            <p>• 识别结果会实时显示</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
