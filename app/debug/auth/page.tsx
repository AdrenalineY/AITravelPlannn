'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Descriptions, Button, Space, Alert } from 'antd'

export default function AuthDebugPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkAuth = async () => {
    setLoading(true)
    const supabase = createClient()

    console.log('=== 开始认证检查 ===')

    // 检查 getSession
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    console.log('getSession 结果:', sessionData)
    console.log('getSession 错误:', sessionError)
    setSessionInfo({
      session: sessionData.session,
      error: sessionError,
    })

    // 检查 getUser
    const { data: userData, error: userError } = await supabase.auth.getUser()
    console.log('getUser 结果:', userData)
    console.log('getUser 错误:', userError)
    setUserInfo({
      user: userData.user,
      error: userError,
    })

    // 检查 localStorage
    const keys = Object.keys(localStorage).filter(key => key.includes('supabase'))
    console.log('localStorage keys:', keys)
    keys.forEach(key => {
      console.log(`${key}:`, localStorage.getItem(key))
    })

    // 检查 cookies
    console.log('所有 cookies:', document.cookie)
    const cookies = document.cookie.split(';')
    const supabaseCookies = cookies.filter(c => 
      c.includes('supabase') || c.includes('sb-') || c.includes('auth')
    )
    console.log('Supabase 相关 cookies:', supabaseCookies)

    console.log('=== 认证检查完成 ===')
    setLoading(false)
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="认证状态调试工具">
          <Button type="primary" onClick={checkAuth} loading={loading}>
            重新检查认证状态
          </Button>
        </Card>

        <Card title="Session 信息">
          {sessionInfo?.session ? (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="用户 ID">
                {sessionInfo.session.user?.id}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {sessionInfo.session.user?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Access Token">
                {sessionInfo.session.access_token?.substring(0, 50)}...
              </Descriptions.Item>
              <Descriptions.Item label="Refresh Token">
                {sessionInfo.session.refresh_token?.substring(0, 50)}...
              </Descriptions.Item>
              <Descriptions.Item label="过期时间">
                {new Date(sessionInfo.session.expires_at * 1000).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Token 类型">
                {sessionInfo.session.token_type}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Alert
              message="Session 为空"
              description={sessionInfo?.error?.message || '未获取到 session 信息'}
              type="warning"
            />
          )}
        </Card>

        <Card title="User 信息 (来自 getUser)">
          {userInfo?.user ? (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="用户 ID">{userInfo.user.id}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{userInfo.user.email}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(userInfo.user.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="最后登录">
                {userInfo.user.last_sign_in_at
                  ? new Date(userInfo.user.last_sign_in_at).toLocaleString()
                  : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="Role">{userInfo.user.role}</Descriptions.Item>
              <Descriptions.Item label="AUD">{userInfo.user.aud}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Alert
              message="User 为空"
              description={userInfo?.error?.message || '未获取到用户信息'}
              type="error"
            />
          )}
        </Card>

        <Card title="原始数据 (查看控制台)">
          <Alert
            message="详细信息已输出到浏览器控制台"
            description="打开开发者工具 (F12) 查看完整的认证信息"
            type="info"
          />
          <pre style={{ marginTop: '16px', padding: '12px', background: '#f5f5f5', overflow: 'auto' }}>
            {JSON.stringify({ sessionInfo, userInfo }, null, 2)}
          </pre>
        </Card>
      </Space>
    </div>
  )
}
