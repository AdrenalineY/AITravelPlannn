'use client'

import React, { useState } from 'react'
import { Input, Button, Card, List, Typography, Space, Tag, Spin } from 'antd'
import { SearchOutlined, EnvironmentOutlined, CloseOutlined, UpOutlined, DownOutlined } from '@ant-design/icons'
import { amapJSService } from '@/services/amapJSService'

const { Text } = Typography

interface MapSearchProps {
  onSelectPOI?: (poi: any) => void
  mapCenter?: [number, number]
}

export function MapSearch({ onSelectPOI, mapCenter }: MapSearchProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const handleSearch = async () => {
    if (!keyword.trim()) return

    setSearching(true)
    try {
      const pois = await amapJSService.searchPOI(keyword, mapCenter)
      setResults(pois)
      setCollapsed(false)
    } catch (error) {
      console.error('POI 搜索失败:', error)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelect = (poi: any) => {
    if (onSelectPOI) {
      onSelectPOI(poi)
    }
    setCollapsed(true)
    setKeyword('')
    setResults([])
  }

  if (collapsed) {
    return (
      <div style={{ position: 'relative' }}>
        <Button
          icon={<SearchOutlined />}
          onClick={() => setCollapsed(false)}
          size="large"
          type="primary"
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          搜索地点
        </Button>
      </div>
    )
  }

  return (
    <Card
      size="small"
      bordered={false}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        width: 400,
        maxHeight: '80%',
        overflow: 'auto',
        zIndex: 1000,
        boxShadow: '0 2px 16px rgba(0,0,0,0.15)'
      }}
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong>搜索地点</Text>
          <Button
            type="text"
            size="small"
            icon={collapsed ? <DownOutlined /> : <UpOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Space>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={() => {
            setCollapsed(true)
            setKeyword('')
            setResults([])
          }}
        />
      }
    >
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="搜索景点、餐厅、酒店..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleSearch}
          loading={searching}
        >
          搜索
        </Button>
      </Space.Compact>

      {searching && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip="搜索中..." />
        </div>
      )}

      {!searching && results.length > 0 && (
        <List
          style={{ marginTop: 12 }}
          dataSource={results}
          renderItem={(poi: any) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 0' }}
              onClick={() => handleSelect(poi)}
              extra={
                <Button type="link" size="small">
                  选择
                </Button>
              }
            >
              <List.Item.Meta
                avatar={<EnvironmentOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                title={
                  <Space>
                    <Text strong>{poi.name}</Text>
                    {poi.type && <Tag color="blue">{poi.type}</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {poi.address || poi.pname + poi.cityname + poi.adname}
                    </Text>
                    {poi.distance && (
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                        距离: {(poi.distance / 1000).toFixed(1)}km
                      </Text>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {!searching && results.length === 0 && keyword && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
          未找到相关地点
        </div>
      )}
    </Card>
  )
}
