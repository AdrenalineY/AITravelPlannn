'use client'

import React from 'react'
import {
  Timeline,
  Card,
  Tag,
  Space,
  Typography,
  Divider,
  Empty,
  Badge,
} from 'antd'
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  CarOutlined,
  CoffeeOutlined,
  HomeOutlined,
  ThunderboltOutlined,
  CloseCircleOutlined,
  SunOutlined,
  CloudOutlined,
  MoonOutlined,
  StarOutlined,
} from '@ant-design/icons'
import type { ItineraryCard } from '@/types'

const { Text, Paragraph, Title } = Typography

interface ItineraryTimelineProps {
  itinerary: ItineraryCard
}

export function ItineraryTimeline({ itinerary }: ItineraryTimelineProps) {
  if (!itinerary.days || itinerary.days.length === 0) {
    return (
      <Empty
        description="暂无详细行程安排"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  // 获取时段图标
  const getTimePeriodIcon = (period?: string) => {
    switch (period) {
      case 'morning':
        return <SunOutlined className="text-yellow-500" />
      case 'afternoon':
        return <CloudOutlined className="text-blue-400" />
      case 'evening':
        return <MoonOutlined className="text-purple-500" />
      case 'night':
        return <StarOutlined className="text-indigo-600" />
      default:
        return <ClockCircleOutlined />
    }
  }

  // 获取时段标签
  const getTimePeriodLabel = (period?: string) => {
    switch (period) {
      case 'morning':
        return '上午'
      case 'afternoon':
        return '下午'
      case 'evening':
        return '傍晚'
      case 'night':
        return '晚上'
      default:
        return ''
    }
  }

  // 获取活动类型图标
  const getActivityIcon = (type: string, segment: any) => {
    switch (type) {
      case 'transport':
        return <CarOutlined className="text-blue-500" />
      case 'meal':
        return <CoffeeOutlined className="text-orange-500" />
      case 'accommodation':
        return <HomeOutlined className="text-purple-500" />
      case 'activity':
        return <ThunderboltOutlined className="text-green-500" />
      case 'rest':
        return <CloseCircleOutlined className="text-gray-500" />
      default:
        return <EnvironmentOutlined />
    }
  }

  // 获取用餐类型标签
  const getMealTypeLabel = (mealType?: string) => {
    switch (mealType) {
      case 'breakfast':
        return '早餐'
      case 'lunch':
        return '午餐'
      case 'dinner':
        return '晚餐'
      case 'snack':
        return '小吃'
      default:
        return '用餐'
    }
  }

  // 获取交通方式标签
  const getTransportLabel = (mode?: string) => {
    const labels: Record<string, string> = {
      walk: '步行',
      bus: '公交',
      subway: '地铁',
      taxi: '出租车',
      car: '自驾',
      flight: '飞机',
      train: '火车',
      bike: '自行车',
      ship: '轮船',
    }
    return labels[mode || ''] || mode || '交通'
  }

  return (
    <div className="space-y-6">
      {itinerary.days.map((day, dayIndex) => (
        <Card
          key={dayIndex}
          title={
            <div className="flex items-center justify-between">
              <Space>
                <Badge
                  count={day.dayNumber || dayIndex + 1}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <span className="text-lg font-semibold">
                  {day.title || `第${day.dayNumber || dayIndex + 1}天`}
                </span>
              </Space>
              {day.date && (
                <Text type="secondary" className="text-sm">
                  {new Date(day.date).toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </Text>
              )}
            </div>
          }
          extra={
            day.totalDistance || day.totalDuration ? (
              <Space split={<Divider type="vertical" />}>
                {day.totalDistance && (
                  <Text type="secondary" className="text-xs">
                    总路程: {day.totalDistance}km
                  </Text>
                )}
                {day.totalDuration && (
                  <Text type="secondary" className="text-xs">
                    总时长: {Math.floor(day.totalDuration / 60)}h
                    {day.totalDuration % 60}m
                  </Text>
                )}
              </Space>
            ) : null
          }
          className="shadow-sm"
        >
          {/* 当日概要 */}
          {day.summary && (
            <Paragraph className="text-gray-600 mb-4">
              {day.summary}
            </Paragraph>
          )}

          {/* 当日亮点 */}
          {day.highlights && day.highlights.length > 0 && (
            <div className="mb-4">
              <Space wrap>
                {day.highlights.map((highlight, idx) => (
                  <Tag key={idx} color="gold" icon={<StarOutlined />}>
                    {highlight}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          {/* 时间轴 */}
          <Timeline
            items={day.segments?.map((segment, segmentIndex) => ({
              dot: getActivityIcon(segment.type, segment),
              color: segment.type === 'transport' ? 'blue' : 'green',
              children: (
                <div className="pb-4">
                  <div className="flex items-start justify-between">
                    <Space direction="vertical" size={2}>
                      {/* 时间和时段 */}
                      <Space>
                        <Text strong className="text-base">
                          {segment.time}
                        </Text>
                        {segment.timePeriod && (
                          <Tag
                            icon={getTimePeriodIcon(segment.timePeriod)}
                            color="default"
                          >
                            {getTimePeriodLabel(segment.timePeriod)}
                          </Tag>
                        )}
                      </Space>

                      {/* 标题和类型 */}
                      <Space>
                        <Text className="text-base font-medium">
                          {segment.title}
                        </Text>
                        {segment.type === 'meal' && segment.mealType && (
                          <Tag color="orange">
                            {getMealTypeLabel(segment.mealType)}
                          </Tag>
                        )}
                        {segment.type === 'transport' &&
                          segment.transportMode && (
                            <Tag color="blue">
                              {getTransportLabel(segment.transportMode)}
                            </Tag>
                          )}
                      </Space>

                      {/* 地点 */}
                      <Space className="text-gray-600">
                        <EnvironmentOutlined />
                        <Text type="secondary">{segment.location}</Text>
                      </Space>

                      {/* 描述 */}
                      {segment.description && (
                        <Paragraph
                          type="secondary"
                          className="!mb-0 !mt-2 text-sm"
                          ellipsis={{ rows: 2, expandable: true }}
                        >
                          {segment.description}
                        </Paragraph>
                      )}

                      {/* 交通详情 */}
                      {segment.type === 'transport' &&
                        segment.transportDetails && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                            <Space split={<Divider type="vertical" />}>
                              {segment.transportDetails.from && (
                                <Text>从: {segment.transportDetails.from}</Text>
                              )}
                              {segment.transportDetails.to && (
                                <Text>到: {segment.transportDetails.to}</Text>
                              )}
                              {segment.transportDetails.duration && (
                                <Text>时长: {segment.transportDetails.duration}</Text>
                              )}
                              {segment.transportDetails.distance && (
                                <Text>距离: {segment.transportDetails.distance}</Text>
                              )}
                            </Space>
                          </div>
                        )}

                      {/* 用餐详情 */}
                      {segment.type === 'meal' && (
                        <div className="mt-2 space-y-1">
                          {segment.restaurant && (
                            <Text type="secondary" className="text-xs">
                              推荐餐厅: {segment.restaurant}
                            </Text>
                          )}
                          {segment.cuisine && (
                            <Text type="secondary" className="text-xs block">
                              菜系: {segment.cuisine}
                            </Text>
                          )}
                          {segment.signature &&
                            segment.signature.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {segment.signature.map((dish, idx) => (
                                  <Tag key={idx} color="orange" className="text-xs">
                                    {dish}
                                  </Tag>
                                ))}
                              </div>
                            )}
                        </div>
                      )}

                      {/* 小贴士 */}
                      {segment.tips && segment.tips.length > 0 && (
                        <div className="mt-2">
                          {segment.tips.map((tip, idx) => (
                            <Text
                              key={idx}
                              type="warning"
                              className="text-xs block"
                            >
                              💡 {tip}
                            </Text>
                          ))}
                        </div>
                      )}
                    </Space>

                    {/* 右侧信息 */}
                    <Space direction="vertical" align="end" size={2}>
                      {segment.duration && (
                        <Text type="secondary" className="text-xs">
                          {segment.duration}分钟
                        </Text>
                      )}
                      {segment.costEstimate && (
                        <Text className="text-sm font-medium text-green-600">
                          ¥{segment.costEstimate}
                        </Text>
                      )}
                      {segment.rating && (
                        <Space size={2}>
                          <StarOutlined className="text-yellow-500" />
                          <Text className="text-xs">{segment.rating}</Text>
                        </Space>
                      )}
                    </Space>
                  </div>
                </div>
              ),
            }))}
          />
        </Card>
      ))}

      {/* 完整计划描述 */}
      {itinerary.planDescription && (
        <Card
          title={
            <Space>
              <span>完整旅行计划</span>
              <Tag color="blue">AI 生成</Tag>
            </Space>
          }
          className="shadow-sm"
        >
          <Paragraph
            style={{ whiteSpace: 'pre-wrap' }}
            className="text-gray-700"
          >
            {itinerary.planDescription}
          </Paragraph>
        </Card>
      )}
    </div>
  )
}
