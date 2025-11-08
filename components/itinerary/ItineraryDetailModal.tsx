'use client'

import React, { useState, useMemo } from 'react'
import {
  Modal,
  Tabs,
  Typography,
  Space,
  Tag,
  Timeline,
  Card,
  Row,
  Col,
  Divider,
  Descriptions,
  Alert,
  Button,
  Tooltip,
  Empty,
  Collapse,
  List,
  Avatar,
} from 'antd'
import {
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CarOutlined,
  HomeOutlined,
  ShoppingOutlined,
  CoffeeOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  BulbOutlined,
  HeartOutlined,
  PhoneOutlined,
  InfoCircleOutlined,
  StarFilled,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { ItineraryCard } from '@/types'
import { ItineraryTimeline } from './ItineraryTimeline'
import { HorizontalTimeline } from './HorizontalTimeline'
import ItineraryMapView from '@/components/map/ItineraryMapView'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

interface ItineraryDetailModalProps {
  open: boolean
  itinerary: ItineraryCard | null
  onClose: () => void
  onEdit?: () => void
  onContinueChat?: () => void
}

export function ItineraryDetailModal({
  open,
  itinerary,
  onClose,
  onEdit,
  onContinueChat,
}: ItineraryDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [mapKey, setMapKey] = useState(0)

  // 当切换到行程标签页时,重新渲染地图
  React.useEffect(() => {
    if (open && activeTab === 'itinerary') {
      // 延迟重新渲染,确保 DOM 已准备好
      const timer = setTimeout(() => {
        setMapKey(prev => prev + 1)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, activeTab])

  if (!itinerary) return null

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '未设定'
    const date = new Date(dateStr)
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return ''
    // 处理 "09:00" 或 "09:00-12:00" 格式
    return timeStr
  }

  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'transport':
        return <CarOutlined className="text-blue-500" />
      case 'accommodation':
        return <HomeOutlined className="text-purple-500" />
      case 'meal':
        return <CoffeeOutlined className="text-orange-500" />
      case 'activity':
        return <ThunderboltOutlined className="text-green-500" />
      case 'rest':
        return <ClockCircleOutlined className="text-gray-500" />
      default:
        return <EnvironmentOutlined />
    }
  }

  // 概览标签页
  const renderOverview = () => (
    <div className="space-y-6">
      {/* 基本信息卡片 */}
      <Card title="基本信息" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="目的地" span={2}>
            <Space>
              <EnvironmentOutlined />
              <Text strong>{itinerary.destination || itinerary.cities?.join('、')}</Text>
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="出行日期">
            <Space>
              <CalendarOutlined />
              {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="行程时长">
            <Space>
              <ClockCircleOutlined />
              {(() => {
                // 优先使用 durationDays/durationNights
                const days = itinerary.durationDays || itinerary.totalDays || itinerary.days?.length || 0
                const nights = itinerary.durationNights ?? itinerary.totalNights ?? Math.max(0, days - 1)
                return `${days}天${nights}晚`
              })()}
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="出行人数">
            <Space>
              <TeamOutlined />
              {itinerary.travelers}人
              {itinerary.travelersDetail && (
                <Text type="secondary">
                  ({itinerary.travelersDetail.adults}大
                  {(itinerary.travelersDetail.children || 0) > 0 && ` ${itinerary.travelersDetail.children}小`})
                </Text>
              )}
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="旅行风格">
            <Tag color="blue">{itinerary.travelStyle || '休闲'}</Tag>
          </Descriptions.Item>
          
          {itinerary.theme && (
            <Descriptions.Item label="主题" span={2}>
              <Tag color="purple">{itinerary.theme}</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 预算信息 */}
      {(itinerary.estimatedCost || itinerary.totalBudget || itinerary.budgetPerPerson) && (
        <Card title="预算概览" size="small">
          <Row gutter={[16, 16]}>
            {itinerary.totalBudget && (
              <Col span={8}>
                <div className="text-center">
                  <Text type="secondary">总预算</Text>
                  <div className="text-2xl font-bold text-green-600 mt-2">
                    ¥{itinerary.totalBudget}
                  </div>
                </div>
              </Col>
            )}
            {itinerary.estimatedCost?.total && (
              <Col span={8}>
                <div className="text-center">
                  <Text type="secondary">预估费用</Text>
                  <div className="text-2xl font-bold text-blue-600 mt-2">
                    ¥{itinerary.estimatedCost.total}
                  </div>
                </div>
              </Col>
            )}
            {(() => {
              // 计算人均费用: 优先使用预估费用/人数,其次使用budgetPerPerson
              const travelers = itinerary.travelers || 1
              let perPersonCost = 0
              
              if (itinerary.estimatedCost?.total && travelers > 0) {
                // 优先使用预估费用除以人数
                perPersonCost = Math.round(itinerary.estimatedCost.total / travelers)
              } else if (itinerary.estimatedCost?.perPerson) {
                perPersonCost = itinerary.estimatedCost.perPerson
              } else if (itinerary.budgetPerPerson) {
                perPersonCost = itinerary.budgetPerPerson
              } else if (itinerary.totalBudget && travelers > 0) {
                // 使用总预算除以人数
                perPersonCost = Math.round(itinerary.totalBudget / travelers)
              }
              
              return perPersonCost > 0 ? (
                <Col span={8}>
                  <div className="text-center">
                    <Text type="secondary">人均费用</Text>
                    <div className="text-2xl font-bold text-orange-600 mt-2">
                      ¥{perPersonCost}
                    </div>
                  </div>
                </Col>
              ) : null
            })()}
          </Row>

          {itinerary.estimatedCost?.breakdown && itinerary.estimatedCost.breakdown.length > 0 && (
            <>
              <Divider />
              <Row gutter={[8, 8]}>
                {itinerary.estimatedCost.breakdown.map((item, idx) => (
                  <Col span={12} key={idx}>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <Space>
                        <DollarOutlined />
                        <Text>{getCategoryName(item.category)}</Text>
                      </Space>
                      <Text strong>¥{item.amount}</Text>
                    </div>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Card>
      )}

      {/* 住宿推荐 */}
      {itinerary.accommodation?.recommendations && itinerary.accommodation.recommendations.length > 0 && (
        <Card title="住宿推荐" size="small">
          <Space direction="vertical" className="w-full" size="middle">
            {itinerary.accommodation.recommendations.map((hotel, idx) => (
              <Card key={idx} size="small" className="bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Space>
                      <HomeOutlined className="text-lg" />
                      <Text strong className="text-base">{hotel.name}</Text>
                      {hotel.rating && (
                        <Space size={2}>
                          <StarFilled className="text-yellow-500 text-xs" />
                          <Text className="text-sm">{hotel.rating}</Text>
                        </Space>
                      )}
                    </Space>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-gray-600">
                        <EnvironmentOutlined className="mr-1" />
                        {hotel.location}
                      </div>
                      {hotel.pricePerNight && (
                        <div className="text-sm">
                          <Text type="secondary">价格: </Text>
                          <Text strong className="text-green-600">¥{hotel.pricePerNight}/晚</Text>
                          {hotel.totalNights && (
                            <Text type="secondary"> × {hotel.totalNights}晚 = ¥{hotel.totalCost}</Text>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {/* 行程亮点 */}
      {itinerary.days && itinerary.days.some(d => d.highlights && d.highlights.length > 0) && (
        <Card title="行程亮点" size="small">
          <Space direction="vertical" className="w-full">
            {itinerary.days.map((day, idx) => (
              day.highlights && day.highlights.length > 0 && (
                <div key={idx}>
                  <Text strong>第{day.dayNumber || idx + 1}天: </Text>
                  <Text>{day.highlights.join(' · ')}</Text>
                </div>
              )
            ))}
          </Space>
        </Card>
      )}
    </div>
  )

  // 详细行程标签页 - 上半部分地图,下半部分时间轴
  const renderItinerary = () => (
    <div style={{ height: 'calc(100vh - 300px)', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      {/* 上半部分: 地图 (45% 高度) */}
      <div style={{ height: '45%', marginBottom: 16, borderRadius: 8, overflow: 'hidden' }}>
        {itinerary && itinerary.days && itinerary.days.length > 0 ? (
          <ItineraryMapView
            key={mapKey}
            itineraryCard={itinerary}
            showAllDays={true}
            height="100%"
          />
        ) : (
          <div style={{ 
            height: '100%', 
            background: '#f5f5f5', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#999',
            borderRadius: 8
          }}>
            <div style={{ textAlign: 'center' }}>
              <EnvironmentOutlined style={{ fontSize: 48, marginBottom: 8 }} />
              <div>暂无地点坐标信息</div>
            </div>
          </div>
        )}
      </div>

      {/* 下半部分: 时间轴 (55% 高度,可滚动) */}
      <div style={{ height: '55%', overflow: 'auto', paddingRight: 8 }}>
        <HorizontalTimeline itinerary={itinerary} />
      </div>
    </div>
  )

  // 美食推荐标签页
  const renderFood = () => (
    <div>
      {itinerary.foodRecommendations && itinerary.foodRecommendations.length > 0 ? (
        <List
          dataSource={itinerary.foodRecommendations}
          renderItem={(food, idx) => (
            <List.Item key={idx}>
              <Card size="small" className="w-full">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Space className="mb-2">
                      <CoffeeOutlined className="text-orange-500 text-lg" />
                      <Text strong className="text-base">{food.name}</Text>
                      {food.mustTry && <Tag color="red">必吃</Tag>}
                      {food.rating && (
                        <Space size={2}>
                          <StarFilled className="text-yellow-500 text-xs" />
                          <Text className="text-sm">{food.rating}</Text>
                        </Space>
                      )}
                    </Space>

                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">
                        <EnvironmentOutlined className="mr-1" />
                        {food.location}
                      </div>
                      {food.cuisine && (
                        <div className="text-sm">
                          <Tag>{food.cuisine}</Tag>
                        </div>
                      )}
                      {food.signature && food.signature.length > 0 && (
                        <div className="text-sm">
                          <Text type="secondary">招牌菜: </Text>
                          <Text>{food.signature.join('、')}</Text>
                        </div>
                      )}
                      {food.avgCost && (
                        <div className="text-sm">
                          <DollarOutlined className="mr-1" />
                          <Text>人均: </Text>
                          <Text strong className="text-green-600">¥{food.avgCost}</Text>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <Empty description="暂无美食推荐" />
      )}
    </div>
  )

  // 实用建议标签页
  const renderTips = () => (
    <div className="space-y-4">
      {itinerary.tips ? (
        <>
          {itinerary.tips.bestTime && (
            <Card size="small" title={<><CalendarOutlined className="mr-2" />最佳旅行时间</>}>
              <Paragraph>{itinerary.tips.bestTime}</Paragraph>
            </Card>
          )}

          {itinerary.tips.weather && (
            <Card size="small" title={<><CloudOutlined className="mr-2" />天气提示</>}>
              <Paragraph>{itinerary.tips.weather}</Paragraph>
            </Card>
          )}

          {itinerary.tips.transportation && itinerary.tips.transportation.length > 0 && (
            <Card size="small" title={<><CarOutlined className="mr-2" />交通建议</>}>
              <ul className="pl-4">
                {itinerary.tips.transportation.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </Card>
          )}

          {itinerary.tips.packing && itinerary.tips.packing.length > 0 && (
            <Card size="small" title={<><ShoppingOutlined className="mr-2" />打包清单</>}>
              <Space size={[0, 8]} wrap>
                {itinerary.tips.packing.map((item, idx) => (
                  <Tag key={idx} icon={<CheckCircleOutlined />}>
                    {item}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {itinerary.tips.safety && itinerary.tips.safety.length > 0 && (
            <Card size="small" title={<><SafetyOutlined className="mr-2" />安全提示</>}>
              <Alert
                message="重要提醒"
                description={
                  <ul className="pl-4 mb-0">
                    {itinerary.tips.safety.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                }
                type="warning"
                showIcon
              />
            </Card>
          )}

          {itinerary.tips.cultural && itinerary.tips.cultural.length > 0 && (
            <Card size="small" title={<><BulbOutlined className="mr-2" />文化习俗</>}>
              <ul className="pl-4">
                {itinerary.tips.cultural.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </Card>
          )}

          {itinerary.tips.emergencyContact && (
            <Card size="small" title={<><PhoneOutlined className="mr-2" />紧急联系</>}>
              <Paragraph>{itinerary.tips.emergencyContact}</Paragraph>
            </Card>
          )}
        </>
      ) : (
        <Empty description="暂无实用建议" />
      )}
    </div>
  )

  const getCategoryName = (category: string) => {
    const map: Record<string, string> = {
      transport: '交通',
      accommodation: '住宿',
      food: '餐饮',
      meal: '餐饮',  // 🆕 添加 meal 映射
      activity: '活动',
      ticket: '门票',  // 🆕 添加 ticket 映射
      shopping: '购物',
    }
    return map[category] || category
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1000}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          {/* 移除继续对话按钮 */}
          {onEdit && (
            <Button type="primary" onClick={onEdit}>
              编辑行程
            </Button>
          )}
        </Space>
      }
      title={
        <div className="flex items-center justify-between pr-8">
          <Title level={3} className="!mb-0">
            {itinerary.title || '行程详情'}
          </Title>
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
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="概览" key="overview" icon={<InfoCircleOutlined />}>
          {renderOverview()}
        </TabPane>
        <TabPane tab="详细行程" key="itinerary" icon={<CalendarOutlined />}>
          {renderItinerary()}
        </TabPane>
        <TabPane tab="美食推荐" key="food" icon={<CoffeeOutlined />}>
          {renderFood()}
        </TabPane>
        <TabPane tab="实用建议" key="tips" icon={<BulbOutlined />}>
          {renderTips()}
        </TabPane>
      </Tabs>
    </Modal>
  )
}
