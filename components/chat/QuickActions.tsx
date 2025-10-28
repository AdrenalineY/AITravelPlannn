'use client'

import React from 'react'
import { Card, Button, Space, Tag } from 'antd'
import {
  PlusOutlined,
  CompassOutlined,
  DollarOutlined,
  HistoryOutlined,
} from '@ant-design/icons'

interface QuickActionsProps {
  onNewItinerary: () => void
  onShowHistory?: () => void
  onShowPreferences?: () => void
  onShowBudget?: () => void
}

export function QuickActions({
  onNewItinerary,
  onShowHistory,
  onShowPreferences,
  onShowBudget,
}: QuickActionsProps) {
  const quickSuggestions = [
    '北京三日游',
    '上海周末游',
    '成都美食之旅',
    '杭州西湖一日游',
  ]

  return (
    <div className="p-4 space-y-4">
      {/* 主要操作 */}
      <Card title="快捷操作" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={onNewItinerary}
          >
            新建行程
          </Button>
          {onShowHistory && (
            <Button icon={<HistoryOutlined />} block onClick={onShowHistory}>
              历史行程
            </Button>
          )}
          {onShowPreferences && (
            <Button icon={<CompassOutlined />} block onClick={onShowPreferences}>
              偏好设置
            </Button>
          )}
          {onShowBudget && (
            <Button icon={<DollarOutlined />} block onClick={onShowBudget}>
              预算管理
            </Button>
          )}
        </Space>
      </Card>

      {/* 快速建议 */}
      <Card title="热门推荐" size="small">
        <Space wrap>
          {quickSuggestions.map((suggestion) => (
            <Tag
              key={suggestion}
              className="cursor-pointer"
              onClick={() => {
                // 可以触发快速填充
                console.log('Quick suggestion clicked:', suggestion)
              }}
            >
              {suggestion}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  )
}
