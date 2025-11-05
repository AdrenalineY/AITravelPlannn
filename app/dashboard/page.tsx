'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spin } from 'antd'

/**
 * Dashboard 页面已被新的行程编辑页面取代
 * 自动重定向到新的编辑界面
 */
export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    // 重定向到新的行程编辑页面
    router.replace('/itinerary/edit')
  }, [router])

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Spin size="large" tip="正在跳转到行程编辑页面..." />
    </div>
  )
}
