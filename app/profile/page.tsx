'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Layout,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  message,
  Spin,
  Typography,
  Space,
  Avatar,
  Divider,
} from 'antd'
import {
  UserOutlined,
  SaveOutlined,
  MailOutlined,
  HomeOutlined,
  HeartOutlined,
} from '@ant-design/icons'
import { NavigationHeader } from '@/components/navigation/NavigationHeader'
import type { TravelPreferencesProfile } from '@/types'

const { Content } = Layout
const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface ProfileData {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
  travelPreferences: TravelPreferencesProfile
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  // 加载用户信息
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/profile')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '加载失败')
      }

      setProfileData(data.profile)
      
      // 设置表单初始值
      form.setFieldsValue({
        fullName: data.profile.fullName || '',
        email: data.profile.email,
        gender: data.profile.travelPreferences?.gender,
        age: data.profile.travelPreferences?.age,
        city: data.profile.travelPreferences?.city,
        personalInterests: data.profile.travelPreferences?.personalInterests,
      })

    } catch (error: any) {
      console.error('[Profile] Load error:', error)
      message.error(error.message || '加载用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      setSaving(true)

      const travelPreferences: TravelPreferencesProfile = {
        gender: values.gender,
        age: values.age,
        city: values.city,
        personalInterests: values.personalInterests,
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: values.fullName,
          travelPreferences,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '保存失败')
      }

      message.success('个人信息已保存')
      setProfileData(data.profile)

    } catch (error: any) {
      console.error('[Profile] Save error:', error)
      message.error(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <NavigationHeader />
        <Content style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f0f2f5'
        }}>
          <Spin size="large" tip="加载中..." />
        </Content>
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <NavigationHeader />
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* 页面标题 */}
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>个人信息</Title>
            <Text type="secondary">
              完善您的个人信息和旅行偏好，AI 将为您提供更个性化的行程规划
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            {/* 基本信息卡片 */}
            <Card 
              title={
                <Space>
                  <UserOutlined />
                  <span>基本信息</span>
                </Space>
              }
              style={{ marginBottom: 24 }}
            >
              {/* 用户头像 */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Avatar
                  size={100}
                  icon={<UserOutlined />}
                  src={profileData?.avatarUrl}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">头像功能开发中</Text>
                </div>
              </div>

              <Divider />

              <Form.Item
                name="fullName"
                label="姓名"
                rules={[
                  { max: 100, message: '姓名不能超过100个字符' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />}
                  placeholder="请输入您的姓名" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="email"
                label="邮箱"
              >
                <Input 
                  prefix={<MailOutlined />}
                  disabled 
                  size="large"
                />
              </Form.Item>
            </Card>

            {/* 旅行偏好卡片 */}
            <Card 
              title={
                <Space>
                  <HeartOutlined />
                  <span>旅行偏好</span>
                </Space>
              }
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  这些信息将帮助 AI 为您规划更合适的行程
                </Text>
              }
              style={{ marginBottom: 24 }}
            >
              <Form.Item
                name="gender"
                label="性别"
                tooltip="AI 会根据性别特点推荐更合适的景点和住宿"
              >
                <Select 
                  placeholder="请选择性别" 
                  size="large"
                  allowClear
                >
                  <Option value="male">男性</Option>
                  <Option value="female">女性</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="age"
                label="年龄"
                tooltip="不同年龄段会有不同的行程节奏和景点推荐"
                rules={[
                  { type: 'number', min: 1, max: 120, message: '请输入有效的年龄(1-120)' }
                ]}
              >
                <InputNumber 
                  placeholder="请输入年龄" 
                  size="large"
                  style={{ width: '100%' }}
                  min={1}
                  max={120}
                />
              </Form.Item>

              <Form.Item
                name="city"
                label="居住城市"
                tooltip="AI 可以根据您的居住地推荐合适的出行方式和目的地"
                rules={[
                  { max: 50, message: '城市名称不能超过50个字符' }
                ]}
              >
                <Input 
                  prefix={<HomeOutlined />}
                  placeholder="例如: 上海" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="personalInterests"
                label="个人喜好"
                tooltip="详细描述您的旅行偏好，AI 会根据这些信息定制专属行程"
                extra="例如：喜欢的景点类型、餐饮偏好、住宿要求、特殊需求等"
                rules={[
                  { max: 2000, message: '个人喜好不能超过2000个字符' }
                ]}
              >
                <TextArea 
                  placeholder="请详细描述您的旅行偏好...&#10;&#10;例如：&#10;- 我喜欢历史文化类景点，偏好深度游而非走马观花&#10;- 喜欢尝试当地特色美食，对住宿环境要求较高&#10;- 不喜欢太紧凑的行程，希望有充足的休息时间&#10;- 对摄影很感兴趣，喜欢风景优美的地方"
                  rows={8}
                  showCount
                  maxLength={2000}
                />
              </Form.Item>
            </Card>

            {/* 保存按钮 */}
            <div style={{ textAlign: 'center' }}>
              <Space size="middle">
                <Button 
                  size="large"
                  onClick={() => router.back()}
                >
                  取消
                </Button>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={saving}
                >
                  保存
                </Button>
              </Space>
            </div>
          </Form>

          {/* 页脚提示 */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              您的个人信息仅用于提供个性化服务，我们会妥善保护您的隐私
            </Text>
          </div>
        </div>
      </Content>
    </Layout>
  )
}
