'use client'

import React from 'react'
import { Card, Timeline, Typography, Tag, Button, Space, Divider } from 'antd'
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { DayPlan } from '@/types'

const { Title, Text, Paragraph } = Typography

interface DayPlanCardProps {
  dayPlan: DayPlan
  dayIndex: number
  onEdit?: (dayIndex: number, activityIndex: number) => void
  onDelete?: (dayIndex: number, activityIndex: number) => void
  onActivityClick?: (activityId: string) => void
}

export function DayPlanCard({
  dayPlan,
  dayIndex,
  onEdit,
  onDelete,
  onActivityClick,
}: DayPlanCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
  }

  return (
    <Card
      className="mb-4"
      title={
        <div className="flex items-center justify-between">
          <Space>
            <Tag color="blue">第 {dayIndex + 1} 天</Tag>
            <span>{formatDate(dayPlan.date)}</span>
          </Space>
          <Tag icon={<DollarOutlined />} color="green">
            ¥{dayPlan.totalCost}
          </Tag>
        </div>
      }
    >
      {dayPlan.summary && (
        <>
          <Paragraph type="secondary">{dayPlan.summary}</Paragraph>
          <Divider />
        </>
      )}

      <Timeline
        items={dayPlan.activities.map((activity, actIndex) => ({
          key: activity.id,
          dot: <ClockCircleOutlined style={{ fontSize: 16 }} />,
          children: (
            <div
              className="cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
              onClick={() => onActivityClick?.(activity.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <Space>
                    <Text strong>{activity.time}</Text>
                    <Text className="text-base">{activity.poiName}</Text>
                  </Space>
                </div>
                <Space>
                  {activity.cost > 0 && (
                    <Tag color="gold">¥{activity.cost}</Tag>
                  )}
                  {onEdit && (
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(dayIndex, actIndex)
                      }}
                    />
                  )}
                  {onDelete && (
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(dayIndex, actIndex)
                      }}
                    />
                  )}
                </Space>
              </div>

              {activity.address && (
                <div className="text-gray-500 text-sm mb-1">
                  <EnvironmentOutlined /> {activity.address}
                </div>
              )}

              {activity.notes && (
                <div className="text-gray-600 text-sm bg-gray-50 p-2 rounded mt-2">
                  {activity.notes}
                </div>
              )}
            </div>
          ),
        }))}
      />
    </Card>
  )
}
