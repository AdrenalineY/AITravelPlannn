'use client'

import React from 'react'
import { Card, Space, Tag, Typography, Button, Tooltip, Badge, Divider } from 'antd'
import {
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  EditOutlined,
  ShareAltOutlined,
  HeartOutlined,
  HeartFilled,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleFilled,
} from '@ant-design/icons'
import type { ItineraryCard as ItineraryCardType } from '@/types'

const { Text, Title, Paragraph } = Typography

interface ItineraryCardProps {
  itinerary: ItineraryCardType
  onClick?: () => void
  onEdit?: () => void
  onShare?: () => void
  onFavorite?: () => void
  isFavorite?: boolean
  showActions?: boolean
  compact?: boolean
}

export function ItineraryCard({
  itinerary,
  onClick,
  onEdit,
  onShare,
  onFavorite,
  isFavorite = false,
  showActions = true,
  compact = false,
}: ItineraryCardProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未设定'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatDateRange = () => {
    if (!itinerary.startDate || !itinerary.endDate) {
      return '日期待定'
    }
    return `${formatDate(itinerary.startDate)} - ${formatDate(itinerary.endDate)}`
  }

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'completed':
        return { icon: <CheckCircleOutlined />, color: 'success', text: '已完成' }
      case 'in-progress':
        return { icon: <ClockCircleFilled />, color: 'processing', text: '进行中' }
      case 'draft':
        return { icon: <EditOutlined />, color: 'default', text: '草稿' }
      case 'cancelled':
        return { icon: <ExclamationCircleOutlined />, color: 'error', text: '已取消' }
      default:
        return { icon: <ClockCircleOutlined />, color: 'default', text: '草稿' }
    }
  }

  const statusConfig = getStatusConfig(itinerary.status)

  const getCoverImage = () => {
    // 根据目的地返回默认封面图
    const destination = itinerary.destination || itinerary.cities?.[0] || ''
    if (destination.includes('上海')) return '/images/destinations/shanghai.jpg'
    if (destination.includes('北京')) return '/images/destinations/beijing.jpg'
    if (destination.includes('杭州')) return '/images/destinations/hangzhou.jpg'
    return '/images/destinations/default.jpg'
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // 防止点击操作按钮时触发卡片点击
    if ((e.target as HTMLElement).closest('.card-actions')) {
      return
    }
    onClick?.()
  }

  const getTravelStyleColor = (style?: string) => {
    const styleMap: Record<string, string> = {
      '休闲': 'blue',
      '深度': 'purple',
      '亲子': 'pink',
      '美食': 'orange',
      '文化': 'geekblue',
      '探险': 'red',
      '购物': 'magenta',
      '浪漫': 'volcano',
    }
    return styleMap[style || ''] || 'default'
  }

  if (compact) {
    // 紧凑模式 - 用于列表视图
    return (
      <Card
        hoverable
        onClick={handleCardClick}
        className="itinerary-card-compact mb-3 transition-all hover:shadow-lg"
        bodyStyle={{ padding: '16px' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Title level={5} className="!mb-0 truncate">
                {itinerary.title || '未命名行程'}
              </Title>
              <Tag color={statusConfig.color} icon={statusConfig.icon}>
                {statusConfig.text}
              </Tag>
            </div>
            
            <Space size="middle" className="text-gray-500 text-sm" wrap>
              <span>
                <EnvironmentOutlined className="mr-1" />
                {itinerary.destination || itinerary.cities?.join('、') || '目的地待定'}
              </span>
              <span>
                <CalendarOutlined className="mr-1" />
                {formatDateRange()}
              </span>
              <span>
                <ClockCircleOutlined className="mr-1" />
                {/* 优先显示独立的天数/晚数，其次显示计算的天数/晚数 */}
                {itinerary.durationDays 
                  ? `${itinerary.durationDays}天${itinerary.durationNights || 0}晚`
                  : itinerary.totalDays 
                    ? `${itinerary.totalDays}天${itinerary.totalNights || 0}晚` 
                    : '时长待定'}
              </span>
              <span>
                <TeamOutlined className="mr-1" />
                {itinerary.travelers || 1}人
              </span>
              {(itinerary.budgetPerPerson || itinerary.totalBudget) && (
                <span>
                  <DollarOutlined className="mr-1" />
                  ¥{itinerary.budgetPerPerson || itinerary.totalBudget}/人
                </span>
              )}
            </Space>
          </div>

          {showActions && (
            <Space className="card-actions ml-4">
              <Tooltip title="查看详情">
                <Button type="text" icon={<EyeOutlined />} onClick={onClick} />
              </Tooltip>
              <Tooltip title="编辑">
                <Button type="text" icon={<EditOutlined />} onClick={onEdit} />
              </Tooltip>
              <Tooltip title={isFavorite ? '取消收藏' : '收藏'}>
                <Button
                  type="text"
                  icon={isFavorite ? <HeartFilled className="text-red-500" /> : <HeartOutlined />}
                  onClick={onFavorite}
                />
              </Tooltip>
            </Space>
          )}
        </div>

        {itinerary.tags && itinerary.tags.length > 0 && (
          <div className="mt-3">
            <Space size={[0, 4]} wrap>
              {itinerary.tags.slice(0, 5).map((tag, idx) => (
                <Tag key={idx} color={getTravelStyleColor(tag)}>
                  {tag}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>
    )
  }

  // 标准卡片模式 - 用于网格视图
  return (
    <Badge.Ribbon text={statusConfig.text} color={statusConfig.color}>
      <Card
        hoverable
        onClick={handleCardClick}
        className="itinerary-card transition-all hover:shadow-xl"
        cover={
          <div
            className="h-48 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${getCoverImage()})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <Title level={4} className="!mb-0 !text-white truncate">
                {itinerary.title || '未命名行程'}
              </Title>
            </div>
          </div>
        }
        actions={
          showActions
            ? [
                <Tooltip key="view" title="查看详情">
                  <Button type="link" icon={<EyeOutlined />} onClick={onClick}>
                    查看
                  </Button>
                </Tooltip>,
                <Tooltip key="edit" title="编辑">
                  <Button type="link" icon={<EditOutlined />} onClick={onEdit}>
                    编辑
                  </Button>
                </Tooltip>,
                <Tooltip key="share" title="分享">
                  <Button type="link" icon={<ShareAltOutlined />} onClick={onShare}>
                    分享
                  </Button>
                </Tooltip>,
              ]
            : undefined
        }
      >
        <div className="space-y-3">
          {/* 目的地和日期 */}
          <div>
            <Space direction="vertical" size="small" className="w-full">
              <div className="flex items-center text-gray-700">
                <EnvironmentOutlined className="mr-2 text-blue-500" />
                <Text strong>
                  {itinerary.destination || itinerary.cities?.join('、') || '目的地待定'}
                </Text>
              </div>
              <div className="flex items-center text-gray-600">
                <CalendarOutlined className="mr-2" />
                <Text>{formatDateRange()}</Text>
              </div>
            </Space>
          </div>

          <Divider className="!my-2" />

          {/* 行程信息 */}
          <Space size="large" wrap>
            <Tooltip title="行程天数">
              <Space>
                <ClockCircleOutlined className="text-gray-500" />
                <Text>
                  {/* 优先显示独立的天数/晚数，其次显示计算的天数/晚数 */}
                  {itinerary.durationDays 
                    ? `${itinerary.durationDays}天${itinerary.durationNights || 0}晚`
                    : itinerary.totalDays 
                      ? `${itinerary.totalDays}天${itinerary.totalNights || 0}晚` 
                      : '时长待定'}
                </Text>
              </Space>
            </Tooltip>
            
            <Tooltip title="出行人数">
              <Space>
                <TeamOutlined className="text-gray-500" />
                <Text>
                  {itinerary.travelers || 1}人
                  {itinerary.travelersDetail && (itinerary.travelersDetail.adults || itinerary.travelersDetail.children) && (
                    <Text type="secondary" className="ml-1 text-xs">
                      ({itinerary.travelersDetail.adults || 0}大
                      {(itinerary.travelersDetail.children || 0) > 0 && ` ${itinerary.travelersDetail.children}小`})
                    </Text>
                  )}
                </Text>
              </Space>
            </Tooltip>

            {(itinerary.budgetPerPerson || itinerary.totalBudget) && (
              <Tooltip title="人均预算">
                <Space>
                  <DollarOutlined className="text-gray-500" />
                  <Text strong className="text-green-600">
                    ¥{itinerary.budgetPerPerson || itinerary.totalBudget}
                  </Text>
                </Space>
              </Tooltip>
            )}
          </Space>

          {/* 旅行风格和标签 */}
          {(itinerary.travelStyle || (itinerary.tags && itinerary.tags.length > 0)) && (
            <>
              <Divider className="!my-2" />
              <Space size={[0, 4]} wrap>
                {itinerary.travelStyle && (
                  <Tag color={getTravelStyleColor(itinerary.travelStyle)} className="!m-0">
                    {itinerary.travelStyle}
                  </Tag>
                )}
                {itinerary.tags?.slice(0, 3).map((tag, idx) => (
                  <Tag key={idx} className="!m-0">
                    {tag}
                  </Tag>
                ))}
              </Space>
            </>
          )}

          {/* 行程亮点 */}
          {itinerary.days && itinerary.days.length > 0 && itinerary.days[0].highlights && (
            <>
              <Divider className="!my-2" />
              <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 text-gray-600 text-sm">
                {itinerary.days[0].highlights.join(' · ')}
              </Paragraph>
            </>
          )}
        </div>
      </Card>
    </Badge.Ribbon>
  )
}
