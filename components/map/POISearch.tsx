'use client'

import React, { useState } from 'react'
import { Input, List, Card, Spin, Empty, Tag, Button, message } from 'antd'
import { SearchOutlined, EnvironmentOutlined, StarOutlined } from '@ant-design/icons'
import { useMapStore } from '@/store/mapStore'
import { mapService } from '@/services/mapService'
import type { POI } from '@/types'

const { Search } = Input

export function POISearch() {
  const {
    searchResults,
    center,
    isSearching,
    setSearchResults,
    setIsSearching,
    addMarker,
    setCenter,
    setZoom,
    setSelectedPOI,
  } = useMapStore()

  const [keyword, setKeyword] = useState('')

  const handleSearch = async (value: string) => {
    if (!value.trim()) return

    setKeyword(value)
    setIsSearching(true)

    try {
      const results = await mapService.searchPOI(value, center)
      setSearchResults(results)
      
      if (results.length === 0) {
        message.info('未找到相关地点，请尝试其他关键词')
      }
    } catch (error) {
      console.error('搜索失败:', error)
      message.error('搜索失败: ' + (error as Error).message)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handlePOIClick = (poi: POI) => {
    console.log('POI clicked:', poi.name, poi.location)
    
    // 显示选中提示
    message.success(`已选中: ${poi.name}`)
    
    // 更新选中的 POI
    setSelectedPOI(poi)
    
    // 添加标记到地图
    addMarker(poi)
    
    // 移动地图中心到选中的 POI
    setCenter(poi.location)
    
    // 设置合适的缩放级别
    setZoom(16)
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 搜索框 */}
      <div className="p-4 border-b">
        <Search
          placeholder="搜索景点、餐厅、酒店..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          onSearch={handleSearch}
          loading={isSearching}
        />
      </div>

      {/* 搜索结果 */}
      <div className="flex-1 overflow-auto">
        {isSearching ? (
          <div className="flex items-center justify-center h-full">
            <Spin tip="搜索中..." />
          </div>
        ) : searchResults.length === 0 && keyword ? (
          <Empty
            description="未找到相关地点"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="mt-12"
          />
        ) : searchResults.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <EnvironmentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>搜索您感兴趣的地点</p>
          </div>
        ) : (
          <List
            dataSource={searchResults}
            renderItem={(poi) => (
              <List.Item
                className="cursor-pointer hover:bg-gray-50 transition-colors px-4"
                onClick={() => handlePOIClick(poi)}
              >
                <List.Item.Meta
                  avatar={<div className="text-2xl">📍</div>}
                  title={
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{poi.name}</span>
                      {poi.rating && (
                        <Tag icon={<StarOutlined />} color="gold">
                          {poi.rating.toFixed(1)}
                        </Tag>
                      )}
                    </div>
                  }
                  description={
                    <div className="text-sm">
                      <div className="text-gray-500 mb-1">{poi.category}</div>
                      <div className="text-gray-400 truncate">{poi.address}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  )
}
