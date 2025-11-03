'use client'

import React, { useState } from 'react'
import {
  Card,
  Tag,
  Space,
  Typography,
  Divider,
  Empty,
  Badge,
  Modal,
  Descriptions,
  Row,
  Col,
  Button,
} from 'antd'
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  CarOutlined,
  CoffeeOutlined,
  HomeOutlined,
  ThunderboltOutlined,
  SunOutlined,
  CloudOutlined,
  MoonOutlined,
  StarOutlined,
  StarFilled,
  ShoppingOutlined,
  PhoneOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  CameraOutlined,
} from '@ant-design/icons'
import type { ItineraryCard } from '@/types'

const { Text, Paragraph, Title } = Typography

interface HorizontalTimelineProps {
  itinerary: ItineraryCard
}

export function HorizontalTimeline({ itinerary }: HorizontalTimelineProps) {
  const [selectedSegment, setSelectedSegment] = useState<any>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

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
        return <SunOutlined style={{ fontSize: 24, color: '#faad14' }} />
      case 'afternoon':
        return <CloudOutlined style={{ fontSize: 24, color: '#1890ff' }} />
      case 'evening':
        return <MoonOutlined style={{ fontSize: 24, color: '#722ed1' }} />
      case 'night':
        return <StarOutlined style={{ fontSize: 24, color: '#531dab' }} />
      default:
        return <ClockCircleOutlined style={{ fontSize: 24 }} />
    }
  }

  // 获取活动类型图标和颜色
  const getActivityStyle = (type: string, segment: any) => {
    switch (type) {
      case 'transport':
        return {
          icon: <CarOutlined style={{ fontSize: 32 }} />,
          color: '#1890ff',
          bgColor: '#e6f7ff',
          borderColor: '#91d5ff',
        }
      case 'accommodation':
        return {
          icon: <HomeOutlined style={{ fontSize: 32 }} />,
          color: '#722ed1',
          bgColor: '#f9f0ff',
          borderColor: '#d3adf7',
        }
      case 'meal':
        return {
          icon: <CoffeeOutlined style={{ fontSize: 32 }} />,
          color: '#fa8c16',
          bgColor: '#fff7e6',
          borderColor: '#ffd591',
        }
      case 'activity':
        return {
          icon: <ThunderboltOutlined style={{ fontSize: 32 }} />,
          color: '#52c41a',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f',
        }
      case 'shopping':
        return {
          icon: <ShoppingOutlined style={{ fontSize: 32 }} />,
          color: '#eb2f96',
          bgColor: '#fff0f6',
          borderColor: '#ffadd2',
        }
      case 'rest':
        return {
          icon: <ClockCircleOutlined style={{ fontSize: 32 }} />,
          color: '#8c8c8c',
          bgColor: '#f5f5f5',
          borderColor: '#d9d9d9',
        }
      default:
        return {
          icon: <EnvironmentOutlined style={{ fontSize: 32 }} />,
          color: '#13c2c2',
          bgColor: '#e6fffb',
          borderColor: '#87e8de',
        }
    }
  }

  // 打开详情弹窗
  const openDetailModal = (segment: any) => {
    setSelectedSegment(segment)
    setDetailModalOpen(true)
  }

  // 渲染详情弹窗
  const renderDetailModal = () => {
    if (!selectedSegment) return null

    const style = getActivityStyle(selectedSegment.type, selectedSegment)

    return (
      <Modal
        title={
          <Space>
            <span style={{ color: style.color }}>{style.icon}</span>
            <span>{selectedSegment.title}</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <div className="space-y-4">
          {/* 基本信息 */}
          <Descriptions column={2} bordered size="small">
            {selectedSegment.time && (
              <Descriptions.Item label="时间" span={1}>
                <ClockCircleOutlined className="mr-1" />
                {selectedSegment.time}
              </Descriptions.Item>
            )}
            {selectedSegment.timePeriod && (
              <Descriptions.Item label="时段" span={1}>
                {getTimePeriodIcon(selectedSegment.timePeriod)}
                <span className="ml-2">
                  {selectedSegment.timePeriod === 'morning' && '上午'}
                  {selectedSegment.timePeriod === 'afternoon' && '下午'}
                  {selectedSegment.timePeriod === 'evening' && '傍晚'}
                  {selectedSegment.timePeriod === 'night' && '晚上'}
                </span>
              </Descriptions.Item>
            )}
            {selectedSegment.location && (
              <Descriptions.Item label="地点" span={2}>
                <EnvironmentOutlined className="mr-1" />
                {selectedSegment.location}
              </Descriptions.Item>
            )}
            {selectedSegment.address && (
              <Descriptions.Item label="详细地址" span={2}>
                {selectedSegment.address}
              </Descriptions.Item>
            )}
            {selectedSegment.duration && (
              <Descriptions.Item label="时长" span={1}>
                <ClockCircleOutlined className="mr-1" />
                {selectedSegment.duration}分钟
              </Descriptions.Item>
            )}
            {selectedSegment.costEstimate && (
              <Descriptions.Item label="预估费用" span={1}>
                <DollarOutlined className="mr-1" />
                ¥{selectedSegment.costEstimate}
              </Descriptions.Item>
            )}
            {selectedSegment.rating && (
              <Descriptions.Item label="评分" span={1}>
                <StarFilled style={{ color: '#faad14' }} className="mr-1" />
                {selectedSegment.rating}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 描述 */}
          {selectedSegment.description && (
            <Card size="small" title="详细介绍">
              <Paragraph>{selectedSegment.description}</Paragraph>
            </Card>
          )}

          {/* 交通详情 */}
          {selectedSegment.type === 'transport' && selectedSegment.transportDetails && (
            <Card size="small" title="交通信息">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">出发:</Text>
                  <br />
                  <Text strong>{selectedSegment.transportDetails.from}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">到达:</Text>
                  <br />
                  <Text strong>{selectedSegment.transportDetails.to}</Text>
                </Col>
                {selectedSegment.transportDetails.duration && (
                  <Col span={12}>
                    <Text type="secondary">预计时长:</Text>
                    <br />
                    <Text>{selectedSegment.transportDetails.duration}</Text>
                  </Col>
                )}
                {selectedSegment.transportDetails.distance && (
                  <Col span={12}>
                    <Text type="secondary">距离:</Text>
                    <br />
                    <Text>{selectedSegment.transportDetails.distance}</Text>
                  </Col>
                )}
                {selectedSegment.transportDetails.cost && (
                  <Col span={12}>
                    <Text type="secondary">费用:</Text>
                    <br />
                    <Text>¥{selectedSegment.transportDetails.cost}</Text>
                  </Col>
                )}
              </Row>
              {selectedSegment.transportDetails.notes && (
                <div className="mt-2 p-2 bg-blue-50 rounded">
                  <Text type="secondary">{selectedSegment.transportDetails.notes}</Text>
                </div>
              )}
            </Card>
          )}

          {/* 用餐详情 */}
          {selectedSegment.type === 'meal' && (
            <Card size="small" title="用餐信息">
              {selectedSegment.mealType && (
                <div className="mb-2">
                  <Tag color="orange">
                    {selectedSegment.mealType === 'breakfast' && '早餐'}
                    {selectedSegment.mealType === 'lunch' && '午餐'}
                    {selectedSegment.mealType === 'dinner' && '晚餐'}
                    {selectedSegment.mealType === 'snack' && '小吃'}
                  </Tag>
                </div>
              )}
              {selectedSegment.restaurant && (
                <Paragraph>
                  <Text strong>推荐餐厅: </Text>
                  <Text>{selectedSegment.restaurant}</Text>
                </Paragraph>
              )}
              {selectedSegment.cuisine && (
                <Paragraph>
                  <Text strong>菜系: </Text>
                  <Text>{selectedSegment.cuisine}</Text>
                </Paragraph>
              )}
              {selectedSegment.signature && selectedSegment.signature.length > 0 && (
                <div>
                  <Text strong>招牌菜: </Text>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedSegment.signature.map((dish: string, idx: number) => (
                      <Tag key={idx} color="orange">
                        {dish}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 小贴士 */}
          {selectedSegment.tips && selectedSegment.tips.length > 0 && (
            <Card size="small" title="💡 温馨提示">
              <ul className="pl-4 mb-0">
                {selectedSegment.tips.map((tip: string, idx: number) => (
                  <li key={idx} className="mb-1">
                    {tip}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 预订信息 */}
          {selectedSegment.bookingInfo?.required && (
            <Card size="small" type="inner">
              <Space>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                <Text>
                  需要提前预订
                  {selectedSegment.bookingInfo.advanceTime &&
                    ` (${selectedSegment.bookingInfo.advanceTime})`}
                </Text>
              </Space>
              {selectedSegment.bookingInfo.website && (
                <div className="mt-2">
                  <Text type="secondary">预订网站: </Text>
                  <a href={selectedSegment.bookingInfo.website} target="_blank" rel="noopener noreferrer">
                    {selectedSegment.bookingInfo.website}
                  </a>
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <div className="space-y-8">
      {itinerary.days.map((day, dayIndex) => (
        <div key={dayIndex}>
          {/* 日期卡片 */}
          <Card
            className="mb-4 shadow-md"
            style={{ borderLeft: '4px solid #1890ff' }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Space size="large">
                  <Badge
                    count={day.dayNumber || dayIndex + 1}
                    style={{
                      backgroundColor: '#1890ff',
                      fontSize: 16,
                      width: 32,
                      height: 32,
                      lineHeight: '32px',
                    }}
                  />
                  <div>
                    <Title level={4} className="!mb-0">
                      {day.title || `第${day.dayNumber || dayIndex + 1}天`}
                    </Title>
                    {day.date && (
                      <Text type="secondary">
                        {new Date(day.date).toLocaleDateString('zh-CN', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long',
                        })}
                      </Text>
                    )}
                  </div>
                </Space>
              </Col>
              <Col>
                <Space size="large">
                  {day.totalDistance && (
                    <div className="text-center">
                      <Text type="secondary" className="text-xs block">
                        总路程
                      </Text>
                      <Text strong className="text-lg">
                        {day.totalDistance}km
                      </Text>
                    </div>
                  )}
                  {day.totalDuration && (
                    <div className="text-center">
                      <Text type="secondary" className="text-xs block">
                        总时长
                      </Text>
                      <Text strong className="text-lg">
                        {Math.floor(day.totalDuration / 60)}h
                        {day.totalDuration % 60}m
                      </Text>
                    </div>
                  )}
                </Space>
              </Col>
            </Row>

            {/* 当日概要和亮点 */}
            {(day.summary || (day.highlights && day.highlights.length > 0)) && (
              <div className="mt-4">
                {day.summary && (
                  <Paragraph className="text-gray-600 mb-2">
                    {day.summary}
                  </Paragraph>
                )}
                {day.highlights && day.highlights.length > 0 && (
                  <Space wrap>
                    {day.highlights.map((highlight, idx) => (
                      <Tag key={idx} color="gold" icon={<StarOutlined />}>
                        {highlight}
                      </Tag>
                    ))}
                  </Space>
                )}
              </div>
            )}
          </Card>

          {/* 横向时间轴 */}
          {day.segments && day.segments.length > 0 && (
            <div
              style={{
                overflowX: 'auto',
                paddingBottom: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  minWidth: 'max-content',
                  position: 'relative',
                }}
              >
                {/* 横向时间线 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '80px',
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(to right, #1890ff, #52c41a, #faad14, #722ed1)',
                    zIndex: 0,
                  }}
                />

                {/* 节点 */}
                {day.segments.map((segment, segmentIndex) => {
                  const style = getActivityStyle(segment.type, segment)

                  return (
                    <div
                      key={segmentIndex}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: 200,
                        maxWidth: 250,
                        marginRight: segmentIndex < day.segments!.length - 1 ? 40 : 0,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {/* 节点卡片 */}
                      <Card
                        hoverable
                        onClick={() => openDetailModal(segment)}
                        style={{
                          width: '100%',
                          borderColor: style.borderColor,
                          borderWidth: 2,
                          backgroundColor: style.bgColor,
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                        bodyStyle={{ padding: 12 }}
                        className="hover:shadow-lg"
                      >
                        {/* 图标 */}
                        <div
                          style={{
                            textAlign: 'center',
                            color: style.color,
                            marginBottom: 8,
                          }}
                        >
                          {style.icon}
                        </div>

                        {/* 时间 */}
                        {segment.time && (
                          <div style={{ textAlign: 'center', marginBottom: 4 }}>
                            <Tag icon={<ClockCircleOutlined />} color="default">
                              {segment.time}
                            </Tag>
                          </div>
                        )}

                        {/* 时段标签 */}
                        {segment.timePeriod && (
                          <div style={{ textAlign: 'center', marginBottom: 8 }}>
                            <Tag icon={getTimePeriodIcon(segment.timePeriod)} color="default">
                              {segment.timePeriod === 'morning' && '上午'}
                              {segment.timePeriod === 'afternoon' && '下午'}
                              {segment.timePeriod === 'evening' && '傍晚'}
                              {segment.timePeriod === 'night' && '晚上'}
                            </Tag>
                          </div>
                        )}

                        {/* 标题 */}
                        <div style={{ textAlign: 'center', marginBottom: 8 }}>
                          <Text
                            strong
                            style={{
                              fontSize: 14,
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {segment.title}
                          </Text>
                        </div>

                        {/* 类型标签 */}
                        <div style={{ textAlign: 'center', marginBottom: 8 }}>
                          {segment.type === 'meal' && segment.mealType && (
                            <Tag color="orange">
                              {segment.mealType === 'breakfast' && '早餐'}
                              {segment.mealType === 'lunch' && '午餐'}
                              {segment.mealType === 'dinner' && '晚餐'}
                              {segment.mealType === 'snack' && '小吃'}
                            </Tag>
                          )}
                          {segment.type === 'transport' && segment.transportMode && (
                            <Tag color="blue">
                              {segment.transportMode === 'walk' && '步行'}
                              {segment.transportMode === 'bus' && '公交'}
                              {segment.transportMode === 'subway' && '地铁'}
                              {segment.transportMode === 'taxi' && '出租车'}
                              {segment.transportMode === 'car' && '自驾'}
                              {segment.transportMode === 'flight' && '飞机'}
                              {segment.transportMode === 'train' && '火车'}
                              {segment.transportMode === 'bike' && '自行车'}
                              {segment.transportMode === 'ship' && '轮船'}
                            </Tag>
                          )}
                        </div>

                        {/* 地点 */}
                        {segment.location && (
                          <div style={{ textAlign: 'center', marginBottom: 4 }}>
                            <Text
                              type="secondary"
                              style={{
                                fontSize: 12,
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <EnvironmentOutlined /> {segment.location}
                            </Text>
                          </div>
                        )}

                        {/* 时长和费用 */}
                        <div style={{ textAlign: 'center' }}>
                          <Space size={4} split={<Divider type="vertical" />}>
                            {segment.duration && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {segment.duration}分钟
                              </Text>
                            )}
                            {segment.costEstimate && (
                              <Text style={{ fontSize: 12, color: '#52c41a' }}>
                                ¥{segment.costEstimate}
                              </Text>
                            )}
                          </Space>
                        </div>

                        {/* 评分 */}
                        {segment.rating && (
                          <div style={{ textAlign: 'center', marginTop: 4 }}>
                            <Space size={2}>
                              <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                              <Text style={{ fontSize: 12 }}>{segment.rating}</Text>
                            </Space>
                          </div>
                        )}
                      </Card>

                      {/* 连接线圆点 */}
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: style.color,
                          border: '3px solid white',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          marginTop: 8,
                          position: 'relative',
                          zIndex: 2,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 完整计划描述 */}
      {itinerary.planDescription && (
        <Card
          title={
            <Space>
              <CameraOutlined />
              <span>完整旅行计划</span>
              <Tag color="blue">AI 生成</Tag>
            </Space>
          }
          className="shadow-md"
        >
          <Paragraph
            style={{ whiteSpace: 'pre-wrap' }}
            className="text-gray-700"
          >
            {itinerary.planDescription}
          </Paragraph>
        </Card>
      )}

      {/* 详情弹窗 */}
      {renderDetailModal()}
    </div>
  )
}
