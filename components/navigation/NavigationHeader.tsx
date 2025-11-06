'use client'

import React from 'react'
import { Layout, Button, Space, message } from 'antd'
import { useRouter } from 'next/navigation'
import {
  UnorderedListOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'

const { Header } = Layout

interface NavigationHeaderProps {
  title?: string
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({ 
  title = 'AI 旅行规划助手' 
}) => {
  const router = useRouter()
  const { reset: resetAuth } = useAuthStore()

  const handleNavigation = (key: string) => {
    switch (key) {
      case 'itineraries':
        router.push('/itineraries')
        break
      case 'settings':
        router.push('/setup/api-config')
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

  return (
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
        {title}
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
          API配置
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
  )
}