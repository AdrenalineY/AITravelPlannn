'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Tabs, message, Space } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const { setUser, setSession, setConfigStatus } = useAuthStore()

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true)
      const { user, session } = await authService.signIn(values.email, values.password)
      
      setUser(user)
      setSession(session)
      setConfigStatus(user.configStatus || null)

      message.success('登录成功!')
      
      // 根据用户状态跳转
      const redirectPath = await authService.redirectAfterAuth(user)
      router.push(redirectPath)
    } catch (error: any) {
      message.error(error.message || '登录失败，请检查邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (values: {
    email: string
    password: string
    displayName?: string
  }) => {
    try {
      setLoading(true)
      const { user, session } = await authService.signUp(values.email, values.password, {
        displayName: values.displayName,
      })

      setUser(user)
      setSession(session)

      message.success('注册成功!请前往配置 API 密钥')
      router.push('/setup/api-config')
    } catch (error: any) {
      message.error(error.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const onForgotPassword = async (values: { email: string }) => {
    try {
      setLoading(true)
      await authService.resetPassword(values.email)
      message.success('密码重置邮件已发送，请查收邮箱')
    } catch (error: any) {
      message.error(error.message || '发送失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🌏 AI 旅行规划师
          </h1>
          <p className="text-gray-500">智能规划，轻松出行</p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form name="login" onFinish={onLogin} autoComplete="off" size="large">
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱!' },
                      { type: 'email', message: '请输入有效的邮箱地址!' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="邮箱"
                      autoComplete="email"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码!' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                      autoComplete="current-password"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      size="large"
                    >
                      登录
                    </Button>
                  </Form.Item>

                  <div className="text-center">
                    <Button
                      type="link"
                      onClick={() => setActiveTab('forgot')}
                      size="small"
                    >
                      忘记密码?
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form name="register" onFinish={onRegister} autoComplete="off" size="large">
                  <Form.Item
                    name="displayName"
                    rules={[{ required: true, message: '请输入昵称!' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="昵称" />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱!' },
                      { type: 'email', message: '请输入有效的邮箱地址!' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="邮箱"
                      autoComplete="email"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码!' },
                      { min: 6, message: '密码至少 6 位!' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码（至少 6 位）"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: '请确认密码!' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error('两次输入的密码不一致!'))
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="确认密码"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      size="large"
                    >
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'forgot',
              label: '重置密码',
              children: (
                <Form
                  name="forgot"
                  onFinish={onForgotPassword}
                  autoComplete="off"
                  size="large"
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱!' },
                      { type: 'email', message: '请输入有效的邮箱地址!' },
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      size="large"
                    >
                      发送重置邮件
                    </Button>
                  </Form.Item>

                  <div className="text-center">
                    <Button
                      type="link"
                      onClick={() => setActiveTab('login')}
                      size="small"
                    >
                      返回登录
                    </Button>
                  </div>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
