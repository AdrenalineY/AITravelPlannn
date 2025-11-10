'use client'

import { useEffect, useState } from 'react'
import { Card, Descriptions, Alert, Button, Space, Tag, Divider } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons'

export default function SupabaseConfigCheck() {
  const [config, setConfig] = useState<any>(null)

  const checkConfig = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('=== Supabase 配置检查 ===')
    console.log('URL:', supabaseUrl)
    console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'undefined')

    setConfig({
      url: supabaseUrl,
      key: supabaseKey,
      keyPreview: supabaseKey ? `${supabaseKey.substring(0, 50)}...` : 'undefined',
      isConfigured: !!(supabaseUrl && supabaseKey),
    })
  }

  useEffect(() => {
    checkConfig()
  }, [])

  if (!config) return null

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="Supabase 配置状态">
          {config.isConfigured ? (
            <Alert
              message="Supabase 配置正常"
              description="环境变量已正确设置"
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
            />
          ) : (
            <Alert
              message="Supabase 配置缺失"
              description="请检查 .env.local 文件"
              type="error"
              icon={<CloseCircleOutlined />}
              showIcon
            />
          )}
        </Card>

        <Card title="环境变量详情">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="NEXT_PUBLIC_SUPABASE_URL">
              {config.url || '未设置'}
            </Descriptions.Item>
            <Descriptions.Item label="NEXT_PUBLIC_SUPABASE_ANON_KEY">
              {config.keyPreview}
            </Descriptions.Item>
            <Descriptions.Item label="项目 ID (从 URL 提取)">
              {config.url ? config.url.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] : 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="邮箱确认状态检查">
          <Alert
            message="需要手动检查"
            description={
              <div>
                <p>请访问 Supabase Dashboard 检查邮箱确认设置:</p>
                <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
                  <li>访问: <a href={`https://supabase.com/dashboard/project/${config.url?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]}/auth/providers`} target="_blank" rel="noopener noreferrer">Authentication → Providers</a></li>
                  <li>找到 &quot;Email&quot; 提供商</li>
                  <li>检查 &quot;Confirm email&quot; 是否勾选</li>
                  <li><strong>推荐开发环境: 取消勾选</strong></li>
                </ol>
              </div>
            }
            type="warning"
            icon={<WarningOutlined />}
            showIcon
          />
        </Card>

        <Card title="诊断建议">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Tag color="blue">步骤 1</Tag>
              <span>禁用 Supabase 邮箱确认功能</span>
            </div>
            <div>
              <Tag color="blue">步骤 2</Tag>
              <span>清除浏览器所有数据 (F12 → Application → Clear storage)</span>
            </div>
            <div>
              <Tag color="blue">步骤 3</Tag>
              <span>重启开发服务器 (Ctrl+C 然后 npm run dev)</span>
            </div>
            <div>
              <Tag color="blue">步骤 4</Tag>
              <span>使用新邮箱重新注册</span>
            </div>
            <div>
              <Tag color="blue">步骤 5</Tag>
              <span>访问 /debug/auth 验证 Session 是否存在</span>
            </div>
          </Space>
        </Card>

        <Card title="快速链接">
          <Space wrap>
            <Button 
              type="primary"
              href={`https://supabase.com/dashboard/project/${config.url?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]}/auth/providers`}
              target="_blank"
            >
              打开 Supabase Auth 设置
            </Button>
            <Button 
              href="/debug/auth"
            >
              检查认证状态
            </Button>
            <Button 
              href="/auth/login"
            >
              返回登录页面
            </Button>
            <Button 
              onClick={checkConfig}
            >
              重新检查配置
            </Button>
          </Space>
        </Card>
      </Space>
    </div>
  )
}
