'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Layout, Tabs, Button, Modal, Form, Input, DatePicker, InputNumber, message } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { MapContainer } from '@/components/map/MapContainer'
import { POISearch } from '@/components/map/POISearch'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { QuickActions } from '@/components/chat/QuickActions'
import { ItineraryViewer } from '@/components/itinerary/ItineraryViewer'
import { useAuthStore } from '@/store/authStore'
import { useMapStore } from '@/store/mapStore'
import { useItineraryStore } from '@/store/itineraryStore'
import { useConfigStore } from '@/store/configStore'
import { authService } from '@/services/authService'
import { aiService } from '@/services/aiService'
import { mapService } from '@/services/mapService'
import { itineraryService } from '@/services/itineraryService'
import { agentServiceClient } from '@/services/agentServiceClient'
import { itineraryCardService } from '@/services/itineraryCardService'
import type { TravelRequirements, ChatMessage } from '@/types'

const { Header, Sider, Content } = Layout

// Agent 配置
const AGENT_MAX_TURNS = parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_TURNS || '10', 10)
const { RangePicker } = DatePicker

export default function DashboardPage() {
  const router = useRouter()
  const { user, reset: resetAuth } = useAuthStore()
  const { config } = useConfigStore()
  const { addMarker } = useMapStore()
  const {
    currentItinerary,
    chatMessages,
    isGenerating,
    addChatMessage,
    setCurrentItinerary,
    setIsGenerating,
    currentSession,
    setCurrentSession,
    isAgentRunning,
    setIsAgentRunning,
    setAgentMessages,
    setExtractedPlanCard,
    setPendingQuestions,
  } = useItineraryStore()

  const [collapsed, setCollapsed] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(70) // 左侧面板宽度百分比
  const [isDragging, setIsDragging] = useState(false)
  const [showNewItineraryModal, setShowNewItineraryModal] = useState(false)
  const [form] = Form.useForm()
  const [configLoading, setConfigLoading] = useState(true)
  const { setConfig } = useConfigStore()

  // 检查认证和加载配置
  useEffect(() => {
    const initializeConfig = async () => {
      if (!user) {
        router.push('/auth/login')
        return
      }

      try {
        setConfigLoading(true)
        
        // 从数据库加载配置
        const { configService } = await import('@/services/configService')
        const loadedConfig = await configService.loadConfig(user.id)
        
        if (!loadedConfig) {
          message.warning('配置加载失败，请重新保存配置')
          router.push('/setup/api-config')
          return
        }
        
        if (!loadedConfig.llm?.apiKey || !loadedConfig.map?.webServiceKey) {
          message.warning('请先配置 API 密钥才能使用 Agent 功能')
          router.push('/setup/api-config')
          return
        }

        // 更新 store
        setConfig(loadedConfig)

        // 初始化服务
        if (loadedConfig.llm?.apiKey) {
          aiService.setConfig({
            provider: loadedConfig.llm.provider,
            apiKey: loadedConfig.llm.apiKey,
            baseUrl: loadedConfig.llm.baseUrl,
            model: loadedConfig.llm.model,
          })
        }
        if (loadedConfig.map?.webServiceKey) {
          mapService.setWebServiceKey(loadedConfig.map.webServiceKey)
        }
        
        console.log('[Dashboard] 配置加载成功:', {
          hasLLMKey: !!loadedConfig.llm?.apiKey,
          hasMapKey: !!loadedConfig.map?.webServiceKey,
        })
      } catch (error: any) {
        console.error('[Dashboard] 配置加载失败:', error)
        message.error('加载配置失败: ' + error.message)
        router.push('/setup/api-config')
      } finally {
        setConfigLoading(false)
      }
    }

    initializeConfig()
  }, [user, router])

  // 处理拖拽调整面板宽度
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    const windowWidth = window.innerWidth
    const newWidth = (e.clientX / windowWidth) * 100
    if (newWidth > 30 && newWidth < 80) {
      setLeftPanelWidth(newWidth)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  // 处理登出
  const handleLogout = async () => {
    await authService.signOut()
    resetAuth()
    router.push('/auth/login')
  }

  // 发送消息 (仅使用 Agent 模式)
  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMessage)

    // 使用 Agent 模式
    setIsAgentRunning(true)
    try {
      console.log('[Dashboard] 启动 Agent 模式...')
      
      const result = await agentServiceClient.runAgent({
        message: content,
        sessionId: currentSession?.id,
        maxTurns: AGENT_MAX_TURNS,
      })

      console.log('[Dashboard] Agent 运行完成:', result)

      if (result.success && result.finalAnswer) {
        // 保存会话 ID
        if (result.sessionId && !currentSession) {
          const session = await agentServiceClient.getSession(result.sessionId)
          setCurrentSession(session)
        }

        // 显示 Agent 的最终答案
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-agent`,
          role: 'assistant',
          content: result.finalAnswer,
          timestamp: new Date().toISOString(),
          metadata: {
            type: 'agent_answer',
            agentRunId: result.agentRunId,
          },
        }
        addChatMessage(assistantMessage)

        // 保存 Agent 消息流
        if (result.messages && result.messages.length > 0) {
          setAgentMessages(result.messages)
        }

        // 如果提取到了行程卡片
        if (result.planExtracted) {
          setExtractedPlanCard(result.planExtracted)
          setPendingQuestions(result.planExtracted.pendingQuestions || [])
          
          // 🔧 修复: 后端已经保存了行程数据,前端不需要重复保存
          // Agent API 在 /api/agent/run 中已经完整保存了 itinerary (包括 days 和 activities)
          // 这里只需要显示提示,避免重复创建卡片
          console.log('[Dashboard] 行程数据已由后端保存, itineraryId:', result.itineraryId)
          
          if (result.itineraryId) {
            message.success('行程已自动保存!')
          }
          
          // 显示提示
          if (result.planExtracted.pendingQuestions && result.planExtracted.pendingQuestions.length > 0) {
            message.info(`还有 ${result.planExtracted.pendingQuestions.length} 个问题需要确认`)
          }
        }

        // 如果生成了新的行程
        if (result.itineraryId && !currentItinerary) {
          message.success('行程已自动保存！')
        }
      } else {
        // 如果是配置错误,跳转到配置页面
        if (result.error?.includes('API 密钥') || result.error?.includes('配置')) {
          message.warning(result.error + ' - 正在跳转到配置页面...')
          setTimeout(() => {
            router.push('/setup/api-config')
          }, 1500)
        } else {
          message.error(result.error || 'Agent 运行失败')
        }
      }
    } catch (error: any) {
      // 检查是否是配置相关错误
      const errorMsg = error.message || error.toString() || '未知错误'
      if (errorMsg.includes('API 密钥') || errorMsg.includes('配置') || error.redirectTo) {
        message.warning('请先配置 API 密钥 - 正在跳转到配置页面...')
        setTimeout(() => {
          router.push('/setup/api-config')
        }, 1500)
      } else {
        message.error('Agent 运行失败: ' + errorMsg)
      }
      console.error('[Dashboard] Agent error:', error)
    } finally {
      setIsAgentRunning(false)
    }
  }

  // 创建新行程
  const handleCreateItinerary = async (values: any) => {
    const requirements: TravelRequirements = {
      destination: values.destination,
      startDate: values.dateRange[0].format('YYYY-MM-DD'),
      endDate: values.dateRange[1].format('YYYY-MM-DD'),
      travelers: values.travelers,
      budget: values.budget,
      additionalNotes: values.notes,
    }

    setShowNewItineraryModal(false)
    form.resetFields()
    setIsGenerating(true)

    try {
      const itinerary = await aiService.generateItinerary(requirements)
      itinerary.userId = user!.id
      
      // 保存到 Supabase
      await itineraryService.saveItinerary(itinerary)
      
      setCurrentItinerary(itinerary)
      message.success('行程生成成功!')

      // 在地图上标记景点
      itinerary.days.forEach((day) => {
        day.activities.forEach((activity) => {
          if (activity.poiId) {
            // 这里可以添加地图标记逻辑
          }
        })
      })
    } catch (error) {
      message.error('行程生成失败,请稍后重试')
      console.error('Generate itinerary error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!user) return null

  // 配置加载中
  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg text-gray-600">正在加载配置...</div>
        </div>
      </div>
    )
  }

  return (
    <Layout className="min-h-screen">
      {/* 顶部导航栏 */}
      <Header className="bg-white shadow-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <h1 className="text-xl font-bold m-0">AI 旅行规划师</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<UnorderedListOutlined />}
            onClick={() => router.push('/itineraries')}
          >
            我的行程
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => router.push('/setup/api-config')}
          >
            API 配置
          </Button>
          <Button icon={<UserOutlined />}>{user.displayName || user.email}</Button>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </div>
      </Header>

      <Layout style={{ height: 'calc(100vh - 64px)' }}>
        {/* 左侧地图面板 */}
        <Content
          style={{
            width: `${leftPanelWidth}%`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="h-full flex">
            {/* 地图 */}
            <div className="flex-1 relative">
              <MapContainer />
            </div>

            {/* POI 搜索侧边栏 */}
            {!collapsed && (
              <Sider width={320} theme="light" className="border-l">
                <POISearch />
              </Sider>
            )}
          </div>

          {/* 分隔条 */}
          <div
            className="absolute top-0 right-0 w-1 h-full bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors"
            onMouseDown={() => setIsDragging(true)}
            style={{ zIndex: 1000 }}
          />
        </Content>

        {/* 右侧对话与行程面板 */}
        <Sider
          width={`${100 - leftPanelWidth}%`}
          theme="light"
          style={{
            borderLeft: '1px solid #f0f0f0',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Tabs
              defaultActiveKey="chat"
              style={{ flex: 1, overflow: 'hidden' }}
              className="chat-tabs"
              items={[
                {
                  key: 'chat',
                  label: '🤖 AI 助手',
                  children: (
                    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 64px - 55px)' }}>
                      {/* Agent 会话信息栏 */}
                      {currentSession && (
                        <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-600">🤖 Agent 智能规划模式</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            会话: {currentSession.title || currentSession.id.slice(0, 8)}
                          </span>
                        </div>
                      )}
                      <MessageList messages={chatMessages} />
                      <MessageInput
                        onSendMessage={handleSendMessage}
                        disabled={isAgentRunning}
                        placeholder={
                          isAgentRunning
                            ? '🤖 Agent 正在规划中，请稍候...'
                            : '告诉我您的旅行计划，Agent 会自动为您规划...'
                        }
                      />
                    </div>
                  ),
                },
              {
                key: 'itinerary',
                label: '📋 行程',
                children: (
                  <ItineraryViewer
                    itinerary={currentItinerary}
                    onActivityClick={(activityId) => {
                      console.log('Activity clicked:', activityId)
                      // 这里可以在地图上定位到对应景点
                    }}
                  />
                ),
              },
              {
                key: 'actions',
                label: '⚡ 快捷',
                children: (
                  <QuickActions
                    onNewItinerary={() => setShowNewItineraryModal(true)}
                  />
                ),
              },
            ]}
          />
          </div>
        </Sider>
      </Layout>

      {/* 新建行程对话框 */}
      <Modal
        title="创建新行程"
        open={showNewItineraryModal}
        onCancel={() => setShowNewItineraryModal(false)}
        onOk={() => form.submit()}
        confirmLoading={isGenerating}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateItinerary}>
          <Form.Item
            label="目的地"
            name="destination"
            rules={[{ required: true, message: '请输入目的地' }]}
          >
            <Input placeholder="例如: 北京" size="large" />
          </Form.Item>

          <Form.Item
            label="日期"
            name="dateRange"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <RangePicker style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Form.Item
            label="人数"
            name="travelers"
            initialValue={1}
            rules={[{ required: true, message: '请输入人数' }]}
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Form.Item label="预算 (元)" name="budget">
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              size="large"
              placeholder="选填"
            />
          </Form.Item>

          <Form.Item label="其他要求" name="notes">
            <Input.TextArea
              rows={4}
              placeholder="例如: 喜欢美食、想去博物馆、预算有限..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
