'use client'

import React, { useState, useEffect } from 'react'
import {
  Layout,
  Typography,
  Space,
  Button,
  Input,
  Select,
  Radio,
  Card,
  Row,
  Col,
  Empty,
  Spin,
  message,
  Dropdown,
  Modal,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SortAscendingOutlined,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import { ItineraryCard } from '@/components/itinerary/ItineraryCard'
import { ItineraryDetailModal } from '@/components/itinerary/ItineraryDetailModal'
import type { ItineraryCard as ItineraryCardType } from '@/types'
import { useRouter } from 'next/navigation'
import { itineraryCardService } from '@/services/itineraryCardService'

const { Content } = Layout
const { Title, Text } = Typography
const { Search } = Input

type ViewMode = 'grid' | 'list'
type SortBy = 'date' | 'title' | 'cost' | 'recent'
type FilterStatus = 'all' | 'draft' | 'in-progress' | 'completed' | 'cancelled'

export default function ItinerariesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [itineraries, setItineraries] = useState<ItineraryCardType[]>([])
  const [filteredItineraries, setFilteredItineraries] = useState<ItineraryCardType[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [selectedItinerary, setSelectedItinerary] = useState<ItineraryCardType | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  // 模拟加载数据
  useEffect(() => {
    loadItineraries()
  }, [])

  // 过滤和排序
  useEffect(() => {
    filterAndSortItineraries()
  }, [itineraries, searchText, filterStatus, sortBy])

  const loadItineraries = async () => {
    setLoading(true)
    try {
      // 从 API 加载真实数据
      console.log('[Itineraries] Loading itineraries from database...')
      const data = await itineraryCardService.getAll()
      console.log('[Itineraries] Loaded itineraries:', data.length)
      setItineraries(data)
      
      // 如果没有数据,可以显示模拟数据用于演示
      if (data.length === 0) {
        console.log('[Itineraries] No data found, loading mock data for demo')
        const mockData: ItineraryCardType[] = [
        {
          id: 'plan_1',
          title: '上海3日亲子游',
          destination: '上海',
          cities: ['上海'],
          startDate: '2025-11-10',
          endDate: '2025-11-12',
          totalDays: 3,
          totalNights: 2,
          travelers: 3,
          travelersDetail: {
            adults: 2,
            children: 1,
            ages: [35, 32, 6],
          },
          preferences: ['亲子', '休闲', '主题乐园'],
          totalBudget: 5000,
          budgetPerPerson: 1667,
          currency: 'CNY',
          travelStyle: '亲子',
          status: 'draft',
          tags: ['迪士尼', '亲子游', '休闲'],
          estimatedCost: {
            total: 4800,
            perPerson: 1600,
            breakdown: [
              { category: 'transport', amount: 800, percentage: 17, notes: '高铁往返' },
              { category: 'accommodation', amount: 1600, percentage: 33, notes: '酒店2晚' },
              { category: 'meal', amount: 1200, percentage: 25, notes: '餐饮' },
              { category: 'ticket', amount: 1200, percentage: 25, notes: '门票等' },
            ],
          },
          days: [
            {
              dayNumber: 1,
              date: '2025-11-10',
              title: '初到上海',
              summary: '抵达上海,入住酒店,外滩夜景',
              highlights: ['外滩夜景', '南京路步行街'],
              segments: [],
            },
          ],
          createdAt: '2025-11-01T10:00:00Z',
          updatedAt: '2025-11-01T10:00:00Z',
          version: 1,
        },
        {
          id: 'plan_2',
          title: '杭州2日休闲游',
          destination: '杭州',
          cities: ['杭州'],
          startDate: '2025-11-15',
          endDate: '2025-11-16',
          totalDays: 2,
          totalNights: 1,
          travelers: 2,
          travelersDetail: {
            adults: 2,
            children: 0,
            ages: [28, 26],
          },
          preferences: ['休闲', '美食', '自然'],
          totalBudget: 2000,
          budgetPerPerson: 1000,
          currency: 'CNY',
          travelStyle: '休闲',
          status: 'in_progress',
          tags: ['西湖', '休闲', '美食'],
          estimatedCost: {
            total: 1800,
            perPerson: 900,
            breakdown: [
              { category: 'transport', amount: 400, percentage: 22, notes: '交通' },
              { category: 'accommodation', amount: 600, percentage: 33, notes: '酒店1晚' },
              { category: 'meal', amount: 600, percentage: 33, notes: '餐饮' },
              { category: 'ticket', amount: 200, percentage: 11, notes: '门票' },
            ],
          },
          days: [],
          createdAt: '2025-10-28T14:00:00Z',
          updatedAt: '2025-10-30T16:00:00Z',
          version: 2,
        },
      ]
        setItineraries(mockData)
      }
    } catch (error) {
      console.error('[Itineraries] Failed to load itineraries:', error)
      message.error('加载行程失败')
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortItineraries = () => {
    let filtered = [...itineraries]

    // 状态筛选
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus)
    }

    // 搜索筛选
    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase()
      filtered = filtered.filter(
        item =>
          item.title?.toLowerCase().includes(lowerSearch) ||
          item.destination?.toLowerCase().includes(lowerSearch) ||
          item.cities?.some(city => city.toLowerCase().includes(lowerSearch))
      )
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.startDate || '').getTime() - new Date(b.startDate || '').getTime()
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'cost':
          return (a.totalBudget || 0) - (b.totalBudget || 0)
        case 'recent':
        default:
          return new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime()
      }
    })

    setFilteredItineraries(filtered)
  }

  const handleCreateNew = () => {
    // 跳转到新的行程编辑页面(空白状态)
    router.push('/itinerary/edit')
  }

  const handleViewDetail = (itinerary: ItineraryCardType) => {
    setSelectedItinerary(itinerary)
    setDetailModalOpen(true)
  }

  const handleEdit = (itinerary: ItineraryCardType) => {
    // 跳转到行程编辑页面,带上行程 ID 和会话分组 ID
    const params = new URLSearchParams()
    params.set('id', itinerary.id)
    if (itinerary.sessionGroupId) {
      params.set('sessionGroupId', itinerary.sessionGroupId)
    }
    router.push(`/itinerary/edit?${params.toString()}`)
  }

  const handleShare = (itinerary: ItineraryCardType) => {
    message.info('分享功能开发中')
    // TODO: 生成分享链接
  }

  const handleFavorite = (itinerary: ItineraryCardType) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(itinerary.id)) {
      newFavorites.delete(itinerary.id)
      message.success('已取消收藏')
    } else {
      newFavorites.add(itinerary.id)
      message.success('已添加到收藏')
    }
    setFavorites(newFavorites)
  }

  const handleDelete = (itinerary: ItineraryCardType) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除行程"${itinerary.title}"吗?此操作无法撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('[Itineraries] Deleting itinerary:', itinerary.id)
          await itineraryCardService.delete(itinerary.id)
          setItineraries(prev => prev.filter(item => item.id !== itinerary.id))
          message.success('删除成功')
        } catch (error: any) {
          console.error('[Itineraries] Delete error:', error)
          message.error('删除失败: ' + error.message)
        }
      },
    })
  }

  const handleContinueChat = () => {
    if (selectedItinerary?.sessionGroupId) {
      // 跳转到行程编辑页面并加载历史对话
      const params = new URLSearchParams()
      params.set('id', selectedItinerary.id)
      params.set('sessionGroupId', selectedItinerary.sessionGroupId)
      router.push(`/itinerary/edit?${params.toString()}`)
    } else {
      message.warning('无法继续对话,会话信息丢失')
    }
  }

  const getMoreMenuItems = (itinerary: ItineraryCardType) => [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => handleEdit(itinerary),
    },
    {
      key: 'duplicate',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: () => message.info('复制功能开发中'),
    },
    {
      key: 'export',
      label: '导出',
      icon: <ExportOutlined />,
      onClick: () => message.info('导出功能开发中'),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDelete(itinerary),
    },
  ]

  return (
    <Layout className="min-h-screen bg-gray-50">
      <Content className="p-6">
        {/* 页面标题和操作栏 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Title level={2} className="!mb-0">
              我的行程
            </Title>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleCreateNew}>
              创建新行程
            </Button>
          </div>

          {/* 搜索和筛选 */}
          <Card>
            <Space direction="vertical" size="middle" className="w-full">
              <Search
                placeholder="搜索目的地或行程标题..."
                allowClear
                size="large"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ maxWidth: 600 }}
              />

              <div className="flex items-center justify-between flex-wrap gap-4">
                <Space size="middle" wrap>
                  <Space>
                    <FilterOutlined />
                    <Text>状态:</Text>
                    <Radio.Group value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <Radio.Button value="all">全部</Radio.Button>
                      <Radio.Button value="draft">草稿</Radio.Button>
                      <Radio.Button value="in-progress">进行中</Radio.Button>
                      <Radio.Button value="completed">已完成</Radio.Button>
                    </Radio.Group>
                  </Space>

                  <Space>
                    <SortAscendingOutlined />
                    <Text>排序:</Text>
                    <Select value={sortBy} onChange={setSortBy} style={{ width: 120 }}>
                      <Select.Option value="recent">最近更新</Select.Option>
                      <Select.Option value="date">出发日期</Select.Option>
                      <Select.Option value="title">标题</Select.Option>
                      <Select.Option value="cost">预算</Select.Option>
                    </Select>
                  </Space>
                </Space>

                <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)}>
                  <Radio.Button value="grid">
                    <AppstoreOutlined /> 卡片
                  </Radio.Button>
                  <Radio.Button value="list">
                    <UnorderedListOutlined /> 列表
                  </Radio.Button>
                </Radio.Group>
              </div>
            </Space>
          </Card>
        </div>

        {/* 行程列表 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : filteredItineraries.length === 0 ? (
          <Card>
            <Empty
              description={
                searchText || filterStatus !== 'all'
                  ? '没有找到匹配的行程'
                  : '还没有创建任何行程'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              {!searchText && filterStatus === 'all' && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                  创建第一个行程
                </Button>
              )}
            </Empty>
          </Card>
        ) : viewMode === 'grid' ? (
          <Row gutter={[16, 16]}>
            {filteredItineraries.map(itinerary => (
              <Col key={itinerary.id} xs={24} sm={12} lg={8} xl={6}>
                <ItineraryCard
                  itinerary={itinerary}
                  onClick={() => handleViewDetail(itinerary)}
                  onEdit={() => handleEdit(itinerary)}
                  onShare={() => handleShare(itinerary)}
                  onFavorite={() => handleFavorite(itinerary)}
                  isFavorite={favorites.has(itinerary.id)}
                  showCover={false}
                />
              </Col>
            ))}
          </Row>
        ) : (
          <div>
            {filteredItineraries.map(itinerary => (
              <ItineraryCard
                key={itinerary.id}
                itinerary={itinerary}
                onClick={() => handleViewDetail(itinerary)}
                onEdit={() => handleEdit(itinerary)}
                onShare={() => handleShare(itinerary)}
                onFavorite={() => handleFavorite(itinerary)}
                isFavorite={favorites.has(itinerary.id)}
                compact
                showCover={false}
              />
            ))}
          </div>
        )}

        {/* 详情弹窗 - 包含概览/详细行程/美食/建议等标签页 */}
        <ItineraryDetailModal
          open={detailModalOpen}
          itinerary={selectedItinerary}
          onClose={() => setDetailModalOpen(false)}
          onEdit={() => handleEdit(selectedItinerary!)}
          onContinueChat={handleContinueChat}
        />
      </Content>
    </Layout>
  )
}
