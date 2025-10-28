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
import type { TravelRequirements, ChatMessage } from '@/types'

const { Header, Sider, Content } = Layout
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
  } = useItineraryStore()

  const [collapsed, setCollapsed] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(70) // 左侧面板宽度百分比
  const [isDragging, setIsDragging] = useState(false)
  const [showNewItineraryModal, setShowNewItineraryModal] = useState(false)
  const [form] = Form.useForm()

  // 检查认证和配置
  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // 初始化服务
    if (config) {
      if (config.llm?.apiKey) {
        aiService.setConfig({
          provider: config.llm.provider,
          apiKey: config.llm.apiKey,
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        })
      }
      if (config.map?.webServiceKey) {
        mapService.setWebServiceKey(config.map.webServiceKey)
      }
    }
  }, [user, config, router])

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

  // 发送消息
  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMessage)

    setIsGenerating(true)
    try {
      const response = await aiService.chatWithAI(content, {
        conversationHistory: chatMessages,
        itineraryId: currentItinerary?.id,
      })

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(assistantMessage)
    } catch (error) {
      message.error('AI 响应失败,请稍后重试')
      console.error('AI chat error:', error)
    } finally {
      setIsGenerating(false)
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
                  label: '💬 AI 助手',
                  children: (
                    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 64px - 55px)' }}>
                      <MessageList messages={chatMessages} />
                      <MessageInput
                        onSendMessage={handleSendMessage}
                        disabled={isGenerating}
                        placeholder={
                          isGenerating ? 'AI 正在思考...' : '输入您的旅行需求...'
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
