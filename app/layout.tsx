import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AmapScriptLoader } from '@/components/map/AmapScriptLoader'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI 旅行规划师',
  description: '智能旅行规划，让旅行更简单',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AntdRegistry>
          <ConfigProvider locale={zhCN}>
            {/* 动态加载高德地图 JS API */}
            <AmapScriptLoader />
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
