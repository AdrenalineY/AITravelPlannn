'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Input, InputNumber, Select, Button, Space, message, Row, Col, Typography } from 'antd'
import {
  EnvironmentOutlined,
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import type { ItineraryCard } from '@/types'

const { Title, Text } = Typography
const { TextArea } = Input

interface ItineraryOverviewCardProps {
  itinerary: Partial<ItineraryCard>
  onChange: (updated: Partial<ItineraryCard>) => void
  editable?: boolean
}

export function ItineraryOverviewCard({
  itinerary,
  onChange,
  editable = true,
}: ItineraryOverviewCardProps) {
  const [localData, setLocalData] = useState(itinerary)

  useEffect(() => {
    setLocalData(itinerary)
  }, [itinerary])

  const handleChange = (field: string, value: any) => {
    const updated = { ...localData, [field]: value }
    setLocalData(updated)
    onChange(updated)
  }

  return (
    <Card
      title={<Title level={5} className="!mb-0">行程概览</Title>}
      size="small"
      bordered={false}
      style={{ height: '100%' }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 标题 */}
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>行程标题</Text>
          <Input
            value={localData.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="请输入行程标题"
            disabled={!editable}
            style={{ marginTop: 4 }}
          />
        </div>

        {/* 目的地 */}
        <div>
          <Space size={4} style={{ marginBottom: 4 }}>
            <EnvironmentOutlined style={{ fontSize: 12, color: '#999' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>目的地</Text>
          </Space>
          <Input
            value={localData.destination || ''}
            onChange={(e) => handleChange('destination', e.target.value)}
            placeholder="请输入目的地"
            disabled={!editable}
          />
        </div>

        {/* 行程时长 */}
        <Row gutter={8}>
          <Col span={12}>
            <div>
              <Space size={4} style={{ marginBottom: 4 }}>
                <CalendarOutlined style={{ fontSize: 12, color: '#999' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>天数</Text>
              </Space>
              <InputNumber
                value={localData.durationDays || localData.totalDays || 0}
                onChange={(value) => handleChange('durationDays', value)}
                min={1}
                max={30}
                disabled={!editable}
                style={{ width: '100%' }}
                addonAfter="天"
              />
            </div>
          </Col>
          <Col span={12}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                晚数
              </Text>
              <InputNumber
                value={localData.durationNights || 0}
                onChange={(value) => handleChange('durationNights', value)}
                min={0}
                max={30}
                disabled={!editable}
                style={{ width: '100%' }}
                addonAfter="晚"
              />
            </div>
          </Col>
        </Row>

        {/* 出行人数 */}
        <div>
          <Space size={4} style={{ marginBottom: 4 }}>
            <TeamOutlined style={{ fontSize: 12, color: '#999' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>出行人数</Text>
          </Space>
          <InputNumber
            value={localData.travelers || 1}
            onChange={(value) => handleChange('travelers', value)}
            min={1}
            max={20}
            disabled={!editable}
            style={{ width: '100%' }}
            addonAfter="人"
          />
        </div>

        {/* 预算 */}
        <div>
          <Space size={4} style={{ marginBottom: 4 }}>
            <DollarOutlined style={{ fontSize: 12, color: '#999' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>总预算</Text>
          </Space>
          <InputNumber
            value={localData.totalBudget || 0}
            onChange={(value) => handleChange('totalBudget', value)}
            min={0}
            step={100}
            disabled={!editable}
            style={{ width: '100%' }}
            addonBefore="¥"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
          />
        </div>

        {/* 旅行风格 */}
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            旅行风格
          </Text>
          <Select
            value={localData.travelStyle || '休闲'}
            onChange={(value) => handleChange('travelStyle', value)}
            disabled={!editable}
            style={{ width: '100%' }}
            options={[
              { label: '休闲', value: '休闲' },
              { label: '深度游', value: '深度游' },
              { label: '冒险', value: '冒险' },
              { label: '亲子', value: '亲子' },
              { label: '文化', value: '文化' },
              { label: '美食', value: '美食' },
            ]}
          />
        </div>

        {/* 备注 */}
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            行程备注
          </Text>
          <TextArea
            value={(localData as any).notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="简单描述一下您的旅行计划..."
            disabled={!editable}
            rows={3}
          />
        </div>
      </Space>
    </Card>
  )
}
