'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Layout, Button, message, Spin, Input, Space, Card, Descriptions, Tag, Row, Col } from 'antd'
import {
  SaveOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SendOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  AudioOutlined,
} from '@ant-design/icons'
import AmapView from '@/components/map/AmapView'
import ItineraryMapView from '@/components/map/ItineraryMapView'
import { HorizontalTimeline } from '@/components/itinerary/HorizontalTimeline'
import { MessageList } from '@/components/chat/MessageList'
import { VoiceRecorder } from '@/components/voice/VoiceRecorder'
import type { ItineraryCard, Itinerary } from '@/types'
import type { MapMarker } from '@/services/amapJSService'
import { itineraryCardService } from '@/services/itineraryCardService'
import { agentServiceClient } from '@/services/agentServiceClient'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'

const { Header, Content } = Layout
const { TextArea } = Input

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export default function ItineraryEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itineraryId = searchParams.get('id')
  const sessionGroupId = searchParams.get('sessionGroupId')  // 🔄 重构: sessionId → sessionGroupId
  const { user, reset: resetAuth } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)  // 🆕 保存状态
  const [itinerary, setItinerary] = useState<ItineraryCard | null>(null)
  const [conversationSessionGroupId, setConversationSessionGroupId] = useState<string | null>(sessionGroupId)  // 🔄 重构
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [topSectionHeight, setTopSectionHeight] = useState(300) // 上半部分初始高度
  const [leftWidth, setLeftWidth] = useState(70) // 左侧宽度百分比
  const [isDraggingVertical, setIsDraggingVertical] = useState(false) // 垂直拖拽(上下)
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false) // 水平拖拽(左右)
  const [voiceModalVisible, setVoiceModalVisible] = useState(false) // 语音录制弹窗

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 处理垂直拖拽调整高度(上下)
  const handleVerticalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingVertical(true)
  }

  // 处理水平拖拽调整宽度(左右)
  const handleHorizontalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingHorizontal(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 垂直拖拽(调整上下高度)
      if (isDraggingVertical && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newHeight = e.clientY - containerRect.top - 16 // 减去 padding
        
        // 限制最小和最大高度
        const minHeight = 200
        const maxHeight = containerRect.height - 200 - 32 - 5 // 减去 padding、gap 和分隔条高度
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
          setTopSectionHeight(newHeight)
        }
      }

      // 水平拖拽(调整左右宽度)
      if (isDraggingHorizontal && contentRef.current) {
        const contentRect = contentRef.current.getBoundingClientRect()
        const newWidth = ((e.clientX - contentRect.left) / contentRect.width) * 100
        
        // 限制宽度在 50% 到 85% 之间
        const minWidth = 50
        const maxWidth = 85
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setLeftWidth(newWidth)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDraggingVertical(false)
      setIsDraggingHorizontal(false)
    }

    if (isDraggingVertical || isDraggingHorizontal) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingVertical, isDraggingHorizontal])

  // 加载行程数据
  useEffect(() => {
    const loadItinerary = async () => {
      if (!itineraryId) {
        setLoading(false)
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: '您好!我是 AI 旅行规划助手。请告诉我您的旅行需求,例如:\n\n• 目的地和时长(如"3天2晚的上海之旅")\n• 出行人数和偏好\n• 预算范围\n\n我会为您制定详细的行程计划!',
          timestamp: new Date().toISOString(),
        }])
        return
      }

      try {
        setLoading(true)
        const allItineraries = await itineraryCardService.getAll()
        const data = allItineraries.find(it => it.id === itineraryId)
        
        if (data) {
          setItinerary(data)
          extractMapMarkers(data)
          setMessages([{
            id: 'loaded',
            role: 'assistant',
            content: `已加载行程"${data.title}"。您可以继续对话来调整和完善行程计划。`,
            timestamp: new Date().toISOString(),
          }])
        } else {
          message.error('行程不存在')
          router.push('/itineraries')
        }
      } catch (error) {
        console.error('[ItineraryEdit] 加载行程失败:', error)
        message.error('加载行程失败')
      } finally {
        setLoading(false)
      }
    }

    loadItinerary()
  }, [itineraryId, router])

  // 提取地图标记
  const extractMapMarkers = (data: ItineraryCard) => {
    if (!data.days) return

    const markers: MapMarker[] = []
    data.days.forEach((day: any, dayIndex: number) => {
      day.segments?.forEach((segment: any, segmentIndex: number) => {
        if (segment.coordinates?.lng && segment.coordinates?.lat) {
          markers.push({
            id: `day${dayIndex}-seg${segmentIndex}`,
            position: [segment.coordinates.lng, segment.coordinates.lat],
            title: segment.title || segment.location || '地点',
            content: `<div style="padding: 8px;">
              <div style="font-weight: bold;">${segment.title || segment.location}</div>
              <div style="color: #666; font-size: 12px;">第${dayIndex + 1}天 - ${segment.time || ''}</div>
            </div>`
          })
        }
      })
    })
    setMapMarkers(markers)
  }

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!userInput.trim() || sending) return

    const userMessage = userInput.trim()
    setUserInput('')
    setSending(true)

    // 添加用户消息
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      // 🔄 新建行程时生成 sessionGroupId
      let currentSessionGroupId = conversationSessionGroupId
      if (!currentSessionGroupId) {
        currentSessionGroupId = crypto.randomUUID()
        setConversationSessionGroupId(currentSessionGroupId)
        console.log('[ItineraryEdit] 生成新的 sessionGroupId:', currentSessionGroupId)
      }

      // 调用 Agent API
      const result = await agentServiceClient.runAgent({
        message: userMessage,
        sessionGroupId: currentSessionGroupId,  // 🔄 重构: 确保始终提供 sessionGroupId
        maxTurns: 10,
      })

      // 更新会话分组 ID (以服务器返回为准)
      if (result.sessionGroupId && result.sessionGroupId !== currentSessionGroupId) {
        setConversationSessionGroupId(result.sessionGroupId)
      }

      // 添加 AI 回复
      if (result.finalAnswer) {
        const assistantMessage: Message = {
          id: `${Date.now()}-ai`,
          role: 'assistant',
          content: result.finalAnswer,
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMessage])
      }

      // 如果生成了行程,更新显示
      if (result.planExtracted) {
        setItinerary(result.planExtracted as ItineraryCard)
        extractMapMarkers(result.planExtracted as ItineraryCard)
        message.success('行程已更新')
      }
    } catch (error) {
      console.error('[ItineraryEdit] 发送消息失败:', error)
      message.error('发送失败,请重试')
    } finally {
      setSending(false)
    }
  }

  // 处理语音转文本完成
  const handleVoiceTranscript = (text: string) => {
    setUserInput(text)
    setVoiceModalVisible(false)
    message.success('语音识别完成')
  }

  // 处理完成编辑
  const handleComplete = async () => {
    // 🔄 防止重复提交
    if (saving) {
      console.log('[ItineraryEdit] 正在保存中,忽略重复点击')
      return
    }

    try {
      // 验证必填字段
      if (!itinerary?.title || !itinerary?.destination) {
        message.warning('请先通过对话生成行程内容')
        return
      }

      // 验证 sessionGroupId
      if (!conversationSessionGroupId && !itinerary.sessionGroupId) {
        message.error('缺少会话标识,无法保存行程')
        console.error('[ItineraryEdit] sessionGroupId 缺失:', {
          conversationSessionGroupId,
          itinerarySessionGroupId: itinerary.sessionGroupId
        })
        return
      }

      setSaving(true)
      message.loading({ content: '正在保存行程...', key: 'saving', duration: 0 })

      // 使用 conversationSessionGroupId 或 itinerary.sessionGroupId
      const targetSessionGroupId = conversationSessionGroupId || itinerary.sessionGroupId!
      
      console.log('[ItineraryEdit] 开始保存行程:', {
        mode: itineraryId ? 'update' : 'create',
        itineraryId,
        sessionGroupId: targetSessionGroupId,
        title: itinerary.title
      })

      if (itineraryId) {
        // 更新现有行程
        await itineraryCardService.update({ 
          ...itinerary, 
          id: itineraryId,
          sessionGroupId: targetSessionGroupId
        } as ItineraryCard)
        message.success({ content: '行程已保存', key: 'saving', duration: 2 })
        console.log('[ItineraryEdit] 行程更新成功')
      } else {
        // 创建新行程
        const newItinerary = await itineraryCardService.create({ 
          ...itinerary,
          sessionGroupId: targetSessionGroupId
        } as ItineraryCard)
        message.success({ content: '行程已创建', key: 'saving', duration: 2 })
        console.log('[ItineraryEdit] 行程创建成功:', newItinerary.id)
      }

      // 延迟导航,让用户看到成功提示
      setTimeout(() => {
        router.push('/itineraries')
      }, 500)
    } catch (error: any) {
      console.error('[ItineraryEdit] 保存失败:', error)
      message.error({ 
        content: `保存失败: ${error.message || '未知错误'}`, 
        key: 'saving',
        duration: 3
      })
    } finally {
      setSaving(false)
    }
  }

  // 顶部导航
  const handleNavigation = (key: string) => {
    switch (key) {
      case 'itineraries':
        router.push('/itineraries')
        break
      case 'settings':
        router.push('/setup')
        break
      case 'profile':
        message.info('个人信息功能开发中')
        break
      case 'logout':
        authService.signOut()
        resetAuth()
        router.push('/auth/signin')
        break
    }
  }

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '未设定'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const durationDays = itinerary?.durationDays || itinerary?.totalDays || itinerary?.days?.length || 0
  const durationNights = itinerary?.durationNights ?? Math.max(0, durationDays - 1)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 顶部导航栏 */}
      <Header style={{ 
        background: '#001529', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}>
        <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          AI 旅行规划助手
        </div>
        
        <Space size="middle">
          <Button
            type="text"
            icon={<UnorderedListOutlined />}
            onClick={() => handleNavigation('itineraries')}
            style={{ color: 'white' }}
          >
            我的行程
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => handleNavigation('settings')}
            style={{ color: 'white' }}
          >
            API 设置
          </Button>
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={() => handleNavigation('profile')}
            style={{ color: 'white' }}
          >
            个人信息
          </Button>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => handleNavigation('logout')}
            style={{ color: 'white' }}
            danger
          >
            退出
          </Button>
        </Space>
      </Header>

      {/* 主内容区域 */}
      <Content ref={contentRef} style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* 左侧: 行程信息区域 */}
        <div 
          ref={containerRef}
          style={{ 
            flex: `0 0 ${leftWidth}%`, 
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 4,
            overflow: 'hidden',
            background: '#f0f2f5',
            position: 'relative',
          }}
        >
          {/* 上半部分: 概览信息 + 地图 */}
          <Row gutter={16} style={{ flex: `0 0 ${topSectionHeight}px`, overflow: 'auto' }}>
            {/* 左侧: 概览信息 */}
            <Col span={10}>
              <Card 
                title="行程概览" 
                size="small"
                style={{ height: '100%' }}
                bodyStyle={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
              >
                {itinerary ? (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={<><EnvironmentOutlined /> 目的地</>}>
                      <strong>{itinerary.destination || itinerary.cities?.join('、')}</strong>
                    </Descriptions.Item>
                    
                    <Descriptions.Item label={<><CalendarOutlined /> 出行日期</>}>
                      {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                    </Descriptions.Item>
                    
                    <Descriptions.Item label={<><ClockCircleOutlined /> 行程时长</>}>
                      {durationDays}天{durationNights}晚
                    </Descriptions.Item>
                    
                    <Descriptions.Item label={<><TeamOutlined /> 出行人数</>}>
                      {itinerary.travelers}人
                    </Descriptions.Item>
                    
                    {itinerary.totalBudget && (
                      <Descriptions.Item label={<><DollarOutlined /> 预算</>}>
                        ¥{itinerary.totalBudget}
                      </Descriptions.Item>
                    )}
                    
                    {itinerary.travelStyle && (
                      <Descriptions.Item label="旅行风格">
                        <Tag color="blue">{itinerary.travelStyle}</Tag>
                      </Descriptions.Item>
                    )}
                    
                    {itinerary.tags && itinerary.tags.length > 0 && (
                      <Descriptions.Item label="标签">
                        <Space wrap size={[0, 4]}>
                          {itinerary.tags.map((tag, idx) => (
                            <Tag key={idx} color="purple">{tag}</Tag>
                          ))}
                        </Space>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                ) : (
                  <div style={{ 
                    height: '100%',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#999',
                    textAlign: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>📝</div>
                      <div>通过右侧对话生成行程</div>
                    </div>
                  </div>
                )}
              </Card>
            </Col>

            {/* 右侧: 地图 */}
            <Col span={14}>
              <Card 
                title="地图" 
                size="small"
                style={{ height: '100%' }}
                bodyStyle={{ height: 'calc(100% - 48px)', padding: 0 }}
              >
                {itinerary ? (
                  <ItineraryMapView
                    itineraryCard={itinerary}
                    showAllDays={true}
                    height="100%"
                  />
                ) : (
                  <AmapView
                    markers={mapMarkers}
                    zoom={12}
                    height="100%"
                    autoFitView={mapMarkers.length > 0}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* 垂直拖拽分隔条(上下调节) */}
          <div
            onMouseDown={handleVerticalMouseDown}
            style={{
              height: 12,
              cursor: 'row-resize',
              background: isDraggingVertical ? '#1890ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: isDraggingVertical ? 'none' : 'background 0.3s',
              margin: '2px 0',
            }}
            onMouseEnter={(e) => {
              if (!isDraggingVertical) {
                e.currentTarget.style.background = '#e6f7ff'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDraggingVertical) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <div style={{
              width: 40,
              height: 3,
              background: isDraggingVertical ? 'white' : '#d9d9d9',
              borderRadius: 2,
            }} />
          </div>

          {/* 下半部分: 每日行程时间轴 */}
          <Card 
            title="详细行程" 
            size="small"
            style={{ flex: 1, minHeight: 0 }}
            bodyStyle={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
          >
            {itinerary && itinerary.days && itinerary.days.length > 0 ? (
              <HorizontalTimeline itinerary={itinerary} />
            ) : (
              <div style={{ 
                height: '100%',
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#999',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>📅</div>
                <div>暂无详细行程</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  通过右侧对话让 AI 生成详细的每日行程安排
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 水平拖拽分隔条(左右调节) */}
        <div
          onMouseDown={handleHorizontalMouseDown}
          style={{
            width: 12,
            cursor: 'col-resize',
            background: isDraggingHorizontal ? '#1890ff' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: isDraggingHorizontal ? 'none' : 'background 0.3s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isDraggingHorizontal) {
              e.currentTarget.style.background = '#e6f7ff'
            }
          }}
          onMouseLeave={(e) => {
            if (!isDraggingHorizontal) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        >
          <div style={{
            width: 3,
            height: 40,
            background: isDraggingHorizontal ? 'white' : '#d9d9d9',
            borderRadius: 2,
          }} />
        </div>

        {/* 右侧: AI 对话区域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
        }}>
          {/* 聊天历史 */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
          }}>
            {messages.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                <div>开始对话,让 AI 帮你规划行程</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  例如: "帮我规划一个3天2晚的上海之旅"
                </div>
              </div>
            ) : (
              <>
                <MessageList messages={messages} />
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 快捷输入提示 */}
          {messages.length <= 1 && (
            <div style={{
              padding: '8px 16px',
              borderTop: '1px solid #f0f0f0',
              background: '#fafafa',
            }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>快捷输入:</div>
              <Space wrap size={[4, 4]}>
                <Tag
                  style={{ cursor: 'pointer' }}
                  onClick={() => setUserInput('帮我规划一个3天2晚的上海之旅')}
                >
                  3天2晚上海游
                </Tag>
                <Tag
                  style={{ cursor: 'pointer' }}
                  onClick={() => setUserInput('5天4晚北京深度游,预算5000元')}
                >
                  北京深度游
                </Tag>
                <Tag
                  style={{ cursor: 'pointer' }}
                  onClick={() => setUserInput('帮我安排一个周末杭州亲子游')}
                >
                  杭州亲子游
                </Tag>
              </Space>
            </div>
          )}

          {/* 输入区域 */}
          <div style={{
            borderTop: '1px solid #f0f0f0',
            padding: 16,
          }}>
            <TextArea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="描述您的旅行需求... (Shift+Enter 换行)"
              autoSize={{ minRows: 3, maxRows: 6 }}
              disabled={sending}
              style={{ marginBottom: 12 }}
            />
            
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button
                  icon={<AudioOutlined />}
                  onClick={() => setVoiceModalVisible(true)}
                  disabled={sending}
                  title="语音输入"
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={sending}
                  disabled={!userInput.trim()}
                >
                  发送
                </Button>
              </Space>
              
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleComplete}
                loading={saving}
                disabled={!itinerary?.title || saving}
              >
                {saving ? '保存中...' : '完成编辑'}
              </Button>
            </Space>
          </div>
        </div>

        {/* 语音录制弹窗 */}
        <VoiceRecorder
          visible={voiceModalVisible}
          onClose={() => setVoiceModalVisible(false)}
          onTranscriptComplete={handleVoiceTranscript}
        />
      </Content>
    </Layout>
  )
}
