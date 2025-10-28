'use client'

import React from 'react'
import { Card, Typography, Space, Tag, Button, Divider, Empty } from 'antd'
import {
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  EditOutlined,
  ShareAltOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { DayPlanCard } from './DayPlanCard'
import type { Itinerary } from '@/types'

const { Title, Text, Paragraph } = Typography

interface ItineraryViewerProps {
  itinerary: Itinerary | null
  onEdit?: () => void
  onShare?: () => void
  onExport?: () => void
  onActivityClick?: (activityId: string) => void
  onEditActivity?: (dayIndex: number, activityIndex: number) => void
  onDeleteActivity?: (dayIndex: number, activityIndex: number) => void
}

export function ItineraryViewer({
  itinerary,
  onEdit,
  onShare,
  onExport,
  onActivityClick,
  onEditActivity,
  onDeleteActivity,
}: ItineraryViewerProps) {
  if (!itinerary) {
    return (
      <Card className="h-full">
        <Empty
          description="暂无行程"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Text type="secondary">
            使用 AI 助手创建您的第一个旅行计划吧!
          </Text>
        </Empty>
      </Card>
    )
  }

  const totalDays = itinerary.days.length
  const totalCost = itinerary.days.reduce((sum, day) => sum + day.totalCost, 0)

  return (
    <div className="h-full overflow-auto pb-4">
      {/* 行程头部 */}
      <Card className="mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Title level={3} className="mb-2">
              {itinerary.title}
            </Title>
            <Space wrap size="large">
              <Space>
                <EnvironmentOutlined />
                <Text>{itinerary.destination}</Text>
              </Space>
              <Space>
                <CalendarOutlined />
                <Text>
                  {itinerary.startDate} ~ {itinerary.endDate}
                </Text>
              </Space>
              <Space>
                <TeamOutlined />
                <Text>{itinerary.travelers} 人</Text>
              </Space>
            </Space>
          </div>
          <Space>
            {onEdit && (
              <Button icon={<EditOutlined />} onClick={onEdit}>
                编辑
              </Button>
            )}
            {onShare && (
              <Button icon={<ShareAltOutlined />} onClick={onShare}>
                分享
              </Button>
            )}
            {onExport && (
              <Button icon={<DownloadOutlined />} onClick={onExport}>
                导出
              </Button>
            )}
          </Space>
        </div>

        <Divider />

        {/* 统计信息 */}
        <Space size="large">
          <div>
            <Text type="secondary">行程天数</Text>
            <div className="text-2xl font-bold text-blue-600">{totalDays} 天</div>
          </div>
          <Divider type="vertical" style={{ height: 48 }} />
          <div>
            <Text type="secondary">预计费用</Text>
            <div className="text-2xl font-bold text-green-600">¥{totalCost}</div>
          </div>
          {itinerary.budget > 0 && (
            <>
              <Divider type="vertical" style={{ height: 48 }} />
              <div>
                <Text type="secondary">预算</Text>
                <div className="text-2xl font-bold text-gray-600">¥{itinerary.budget}</div>
              </div>
              <Divider type="vertical" style={{ height: 48 }} />
              <div>
                <Text type="secondary">预算使用率</Text>
                <div className={`text-2xl font-bold ${
                  totalCost > itinerary.budget ? 'text-red-600' : 'text-green-600'
                }`}>
                  {((totalCost / itinerary.budget) * 100).toFixed(1)}%
                </div>
              </div>
            </>
          )}
        </Space>

        {/* 状态标签 */}
        <div className="mt-4">
          <Tag color={
            itinerary.status === 'draft' ? 'default' :
            itinerary.status === 'confirmed' ? 'blue' : 'green'
          }>
            {itinerary.status === 'draft' ? '草稿' :
             itinerary.status === 'confirmed' ? '已确认' : '已完成'}
          </Tag>
        </div>
      </Card>

      {/* 每日行程 */}
      {itinerary.days.map((day, index) => (
        <DayPlanCard
          key={day.id}
          dayPlan={day}
          dayIndex={index}
          onEdit={onEditActivity}
          onDelete={onDeleteActivity}
          onActivityClick={onActivityClick}
        />
      ))}
    </div>
  )
}
