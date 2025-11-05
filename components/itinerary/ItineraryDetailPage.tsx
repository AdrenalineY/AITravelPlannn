'use client'

import React, { useMemo } from 'react'
import { Modal, Button, Space, Typography, Tag, Row, Col } from 'antd'
import { CalendarOutlined, TeamOutlined, ClockCircleOutlined, EnvironmentOutlined } from '@ant-design/icons'
import AmapView from '@/components/map/AmapView'
import { HorizontalTimeline } from './HorizontalTimeline'
import type { ItineraryCard } from '@/types'
import type { MapMarker } from '@/services/amapJSService'

const { Title, Text } = Typography

interface ItineraryDetailPageProps {
  open: boolean
  itinerary: ItineraryCard | null
  onClose: () => void
  onEdit?: () => void
}

export function ItineraryDetailPage({
  open,
  itinerary,
  onClose,
  onEdit,
}: ItineraryDetailPageProps) {
  // 将行程中的所有地点转换为地图标记
  const mapMarkers: MapMarker[] = useMemo(() => {
    if (!itinerary?.days) return []

    const markers: MapMarker[] = []
    
    itinerary.days.forEach((day, dayIndex) => {
      day.segments?.forEach((segment, segmentIndex) => {
        // 使用 coordinates 字段来获取坐标
        if (segment.coordinates && segment.coordinates.lng && segment.coordinates.lat) {
          markers.push({
            id: `day${dayIndex}-seg${segmentIndex}`,
            position: [segment.coordinates.lng, segment.coordinates.lat],
            title: segment.title || segment.location || '未命名地点',
            content: `
              <div style="padding: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">
                  ${segment.title || segment.location}
                </div>
                <div style="color: #666; font-size: 12px;">
                  第${dayIndex + 1}天 - ${segment.time || '时间待定'}
                </div>
                ${segment.description ? `
                  <div style="margin-top: 4px; font-size: 12px;">
                    ${segment.description}
                  </div>
                ` : ''}
              </div>
            `
          })
        }
      })
    })

    return markers
  }, [itinerary])

  // 计算地图中心点(所有标记的平均位置)
  const mapCenter: [number, number] | undefined = useMemo(() => {
    if (mapMarkers.length === 0) return undefined

    const totalLng = mapMarkers.reduce((sum, m) => sum + m.position[0], 0)
    const totalLat = mapMarkers.reduce((sum, m) => sum + m.position[1], 0)

    return [totalLng / mapMarkers.length, totalLat / mapMarkers.length]
  }, [mapMarkers])

  if (!itinerary) return null

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '未设定'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const durationDays = itinerary.durationDays || itinerary.totalDays || itinerary.days?.length || 0
  const durationNights = itinerary.durationNights ?? Math.max(0, durationDays - 1)

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="95vw"
      style={{ top: 20 }}
      bodyStyle={{ padding: 0, height: 'calc(90vh - 110px)' }}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          {onEdit && (
            <Button type="primary" onClick={onEdit}>
              编辑行程
            </Button>
          )}
        </Space>
      }
      title={
        <div className="flex items-center justify-between pr-8">
          <div>
            <Title level={4} className="!mb-1">
              {itinerary.title || '行程详情'}
            </Title>
            <Space size="middle" className="text-sm">
              <Space size={4}>
                <EnvironmentOutlined />
                <Text type="secondary">
                  {itinerary.destination || itinerary.cities?.join('、')}
                </Text>
              </Space>
              <Space size={4}>
                <CalendarOutlined />
                <Text type="secondary">
                  {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                </Text>
              </Space>
              <Space size={4}>
                <ClockCircleOutlined />
                <Text type="secondary">
                  {durationDays}天{durationNights}晚
                </Text>
              </Space>
              <Space size={4}>
                <TeamOutlined />
                <Text type="secondary">{itinerary.travelers}人</Text>
              </Space>
            </Space>
          </div>
          {itinerary.tags && (
            <Space size={[0, 4]}>
              {itinerary.tags.slice(0, 3).map((tag, idx) => (
                <Tag key={idx} color="blue">
                  {tag}
                </Tag>
              ))}
            </Space>
          )}
        </div>
      }
    >
      {/* 上下分屏布局 */}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 上半部分: 地图 (50% 高度) */}
        <div style={{ height: '50%', borderBottom: '1px solid #f0f0f0' }}>
          <AmapView
            markers={mapMarkers}
            center={mapCenter}
            zoom={12}
            height="100%"
            autoFitView={true}
          />
        </div>

        {/* 下半部分: 时间轴 (50% 高度,可滚动) */}
        <div
          style={{
            height: '50%',
            overflow: 'auto',
            padding: '16px 24px'
          }}
        >
          {itinerary.days && itinerary.days.length > 0 ? (
            <HorizontalTimeline itinerary={itinerary} />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无详细行程安排
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
