'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Result } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'

export default function DashboardPage() {
  const router = useRouter()
  const { user, reset } = useAuthStore()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user])

  const handleLogout = async () => {
    await authService.signOut()
    reset()
    router.push('/auth/login')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <Card>
          <Result
            status="success"
            title="✅ 第一阶段开发完成！"
            subTitle={`欢迎，${user.displayName || user.email}！基础认证和 API 配置模块已完成。`}
            extra={[
              <Button type="primary" key="config" onClick={() => router.push('/setup/api-config')}>
                查看 API 配置
              </Button>,
              <Button key="logout" onClick={handleLogout}>
                退出登录
              </Button>,
            ]}
          >
            <div className="text-left bg-gray-100 p-6 rounded">
              <h3 className="font-bold mb-4">🎉 已完成功能：</h3>
              <ul className="space-y-2">
                <li>✅ M1 - 用户认证模块（登录、注册、密码重置）</li>
                <li>✅ M6 - API 配置模块（配置向导、密钥验证、加密存储）</li>
                <li>✅ 用户流程集成（路由保护、自动跳转）</li>
                <li>✅ Zustand 状态管理</li>
                <li>✅ Supabase 集成</li>
              </ul>
              
              <h3 className="font-bold mt-6 mb-4">🚀 下一阶段计划：</h3>
              <ul className="space-y-2">
                <li>⏳ M4 - 地图导航模块</li>
                <li>⏳ M2 - 行程规划模块</li>
                <li>⏳ Dashboard 主界面布局</li>
              </ul>
            </div>
          </Result>
        </Card>
      </div>
    </div>
  )
}
