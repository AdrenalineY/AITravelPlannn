'use client'

import { useState, ChangeEvent } from 'react'

/**
 * 行程数据测试页面
 * 用于直接测试 Agent 提取的结构化数据是否能正确保存和显示
 */
export default function ItineraryTestPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // 示例数据
  const exampleData = {
    title: "北京3日游",
    destination: "北京",
    cities: ["北京"],
    startDate: "2025-01-15",
    endDate: "2025-01-17",
    travelers: 2,
    travelersDetail: {
      adults: 2,
      children: 0
    },
    preferences: ["文化历史", "美食"],
    travelStyle: "休闲",
    totalBudget: 3000,
    budgetPerPerson: 1500,
    currency: "CNY",
    estimatedCost: {
      total: 3000,
      breakdown: [
        { category: "住宿", amount: 800, percentage: 27 },
        { category: "餐饮", amount: 600, percentage: 20 },
        { category: "交通", amount: 400, percentage: 13 },
        { category: "门票", amount: 1200, percentage: 40 }
      ]
    },
    accommodation: {
      type: "酒店",
      location: "王府井附近",
      priceRange: "300-500元/晚"
    },
    days: [
      {
        dayNumber: 1,
        date: "2025-01-15",
        title: "第一天:天安门与故宫",
        summary: "探索北京的历史文化中心",
        highlights: ["天安门广场", "故宫博物院"],
        totalDistance: 5,
        totalDuration: 420,
        segments: [
          {
            order: 1,
            time: "09:00",
            type: "景点",
            title: "天安门广场",
            description: "中国的象征,世界上最大的城市广场",
            address: "北京市东城区长安街",
            coordinates: { lng: 116.397477, lat: 39.903738 },
            duration: 60,
            costEstimate: 0,
            rating: 4.8,
            tips: ["早上人少", "升旗仪式值得观看"]
          },
          {
            order: 2,
            time: "10:30",
            type: "景点",
            title: "故宫博物院",
            description: "明清两代的皇家宫殿,世界文化遗产",
            address: "北京市东城区景山前街4号",
            coordinates: { lng: 116.397026, lat: 39.918058 },
            duration: 240,
            costEstimate: 60,
            rating: 4.9,
            tips: ["建议提前网上订票", "至少预留3-4小时"]
          },
          {
            order: 3,
            time: "12:30",
            type: "餐饮",
            title: "全聚德烤鸭店(王府井店)",
            description: "品尝北京特色烤鸭",
            address: "北京市东城区王府井大街",
            coordinates: { lng: 116.410688, lat: 39.915214 },
            duration: 90,
            costEstimate: 200,
            category: "中餐"
          }
        ]
      },
      {
        dayNumber: 2,
        date: "2025-01-16",
        title: "第二天:长城一日游",
        summary: "登临万里长城,感受古代奇迹",
        highlights: ["八达岭长城"],
        totalDistance: 120,
        totalDuration: 480,
        segments: [
          {
            order: 1,
            time: "08:00",
            type: "交通",
            title: "前往八达岭长城",
            description: "乘坐旅游专线",
            duration: 90,
            costEstimate: 60,
            distanceInfo: {
              distance: 60,
              mode: "汽车"
            }
          },
          {
            order: 2,
            time: "10:00",
            type: "景点",
            title: "八达岭长城",
            description: "明代长城保存最完好的一段",
            address: "北京市延庆区八达岭镇",
            coordinates: { lng: 116.017353, lat: 40.359675 },
            duration: 300,
            costEstimate: 40,
            rating: 4.7,
            tips: ["建议乘坐缆车", "注意保暖"]
          }
        ]
      },
      {
        dayNumber: 3,
        date: "2025-01-17",
        title: "第三天:胡同与现代艺术",
        summary: "体验老北京文化和现代艺术",
        highlights: ["南锣鼓巷", "798艺术区"],
        totalDistance: 15,
        totalDuration: 360,
        segments: [
          {
            order: 1,
            time: "09:30",
            type: "景点",
            title: "南锣鼓巷",
            description: "老北京胡同和特色小店",
            address: "北京市东城区南锣鼓巷",
            coordinates: { lng: 116.40306, lat: 39.93706 },
            duration: 120,
            costEstimate: 0,
            rating: 4.3
          },
          {
            order: 2,
            time: "14:00",
            type: "景点",
            title: "798艺术区",
            description: "北京最著名的当代艺术区",
            address: "北京市朝阳区酒仙桥路4号",
            coordinates: { lng: 116.49622, lat: 39.9847 },
            duration: 180,
            costEstimate: 0,
            rating: 4.5,
            tips: ["周末活动较多", "拍照圣地"]
          }
        ]
      }
    ],
    tips: {
      transportation: "使用北京地铁出行最方便",
      weather: "1月北京寒冷,注意保暖",
      safety: "注意保管贵重物品"
    },
    foodRecommendations: [
      "全聚德烤鸭",
      "老北京炸酱面",
      "豆汁焦圈"
    ],
    shoppingSpots: [
      "王府井大街",
      "西单商场",
      "潘家园古玩市场"
    ],
    transportationSummary: {
      mainMode: "地铁+公交",
      estimatedCost: 400,
      tips: "建议办理一卡通"
    }
  }

  const handleLoadExample = () => {
    setJsonInput(JSON.stringify(exampleData, null, 2))
    setError(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // 验证 JSON 格式
      const parsedData = JSON.parse(jsonInput)
      
      // 🔧 数据格式转换: 支持数据库格式(snake_case)和前端格式(camelCase)
      const normalizedData = normalizeItineraryData(parsedData)
      
      console.log('[Test Tool] 原始数据:', parsedData)
      console.log('[Test Tool] 标准化后数据:', normalizedData)

      // 调用 API 保存数据
      const response = await fetch('/api/itinerary-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '保存失败')
      }

      setResult({
        success: true,
        itineraryId: data.id,
        message: '行程数据保存成功!',
        data: data,
      })
    } catch (err: any) {
      setError(err.message || '发生错误')
      setResult({
        success: false,
        message: err.message,
      })
    } finally {
      setLoading(false)
    }
  }
  
  /**
   * 标准化行程数据: 将数据库格式转换为API格式
   * 同时处理缺失字段和格式问题
   */
  const normalizeItineraryData = (data: any) => {
    // 🔧 移除数据库自动生成的字段
    const {
      id,              // 数据库自动生成UUID
      user_id,         // 使用当前登录用户
      created_at,      // 数据库自动生成
      updated_at,      // 数据库自动生成
      total_days,      // 计算列
      total_nights,    // 计算列
      ...restData
    } = data
    
    // 如果数据已经是前端格式,转换并返回
    if (data.startDate || data.endDate || data.totalBudget) {
      // 同样移除这些字段
      const { 
        id: _id, 
        userId: _userId, 
        createdAt: _createdAt, 
        updatedAt: _updatedAt,
        totalDays: _totalDays,
        totalNights: _totalNights,
        ...cleanData 
      } = data
      return cleanData
    }
    
    // 转换数据库格式 (snake_case) 到前端格式 (camelCase)
    const normalized: any = {
      // 基本信息 (不传 id, user_id, created_at 等数据库生成字段)
      title: restData.title || data.title,
      destination: restData.destination || data.destination,
      cities: restData.cities || data.cities || [],
      
      // 日期 (从 snake_case 转换)
      startDate: data.start_date || data.startDate,
      endDate: data.end_date || data.endDate,
      
      // 旅行者信息
      travelers: data.travelers || 1,
      travelersDetail: data.travelers_detail || data.travelersDetail || {},
      
      // 偏好和风格
      preferences: data.preferences || [],
      travelStyle: data.travel_style || data.travelStyle,
      specialRequests: data.special_requests || data.specialRequests || [],
      theme: data.theme,
      
      // 预算信息
      totalBudget: data.budget || data.totalBudget || 0,
      budgetPerPerson: data.budget_per_person || data.budgetPerPerson,
      currency: data.currency || 'CNY',
      estimatedCost: data.estimated_cost || data.estimatedCost || {},
      
      // 住宿信息
      accommodation: data.accommodation || {},
      
      // 行程天数 (如果有 days 数组)
      days: data.days || [],
      
      // 提示和建议
      tips: data.tips || {},
      foodRecommendations: data.food_recommendations || data.foodRecommendations || [],
      shoppingSpots: data.shopping_spots || data.shoppingSpots || [],
      transportationSummary: data.transportation_summary || data.transportationSummary || {},
      
      // 其他
      fullPlan: data.notes || data.fullPlan || '',
      status: data.status || 'draft',
      tags: data.tags || [],
      isPublic: data.is_public || data.isPublic || false,
      version: data.version || 1,
    }
    
    // 移除 undefined 值
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === undefined) {
        delete normalized[key]
      }
    })
    
    return normalized
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🧪 行程数据测试工具</h1>
        <p className="text-gray-600">
          用于测试从 Agent 提取的结构化数据是否能正确保存到数据库并显示在前端
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧: 输入区域 */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">1. 输入行程数据 (JSON 格式)</h2>
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleLoadExample}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                📋 加载示例数据
              </button>
              <button
                onClick={() => {
                  setJsonInput('')
                  setError(null)
                  setResult(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                🗑️ 清空
              </button>
            </div>

            <textarea
              value={jsonInput}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJsonInput(e.target.value)}
              placeholder="粘贴或编辑 JSON 数据..."
              className="w-full h-[500px] p-4 border rounded-lg font-mono text-sm"
            />

            <button
              onClick={handleSubmit}
              disabled={loading || !jsonInput.trim()}
              className={`w-full mt-4 px-4 py-3 rounded-lg font-semibold transition ${
                loading || !jsonInput.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {loading ? '⏳ 保存中...' : '✅ 提交并保存'}
            </button>
          </div>
        </div>

        {/* 右侧: 结果显示 */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">2. 保存结果</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-xl">❌</span>
                  <div className="flex-1">
                    <p className="font-semibold text-red-800">错误</p>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {result?.success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 text-xl">✅</span>
                  <div className="flex-1">
                    <p className="font-semibold text-green-800">{result.message}</p>
                  </div>
                </div>
              </div>
            )}

            {result?.itineraryId && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">行程 ID:</span>
                    <code className="text-xs bg-white px-2 py-1 rounded border">
                      {result.itineraryId}
                    </code>
                  </div>
                  {result.data?.title && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">标题:</span>
                      <span className="text-sm">{result.data.title}</span>
                    </div>
                  )}
                  {result.data?.destination && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">目的地:</span>
                      <span className="text-sm">{result.data.destination}</span>
                    </div>
                  )}
                </div>

                <a
                  href="/itineraries"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 bg-blue-500 text-white text-center rounded-lg font-semibold hover:bg-blue-600 transition"
                >
                  🗺️ 查看行程列表
                </a>
              </div>
            )}

            {result?.data && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">返回数据 (详细)</h3>
                  <span className="text-xs text-gray-500">
                    {result.data.days?.length ? `包含 ${result.data.days.length} 天行程` : '仅主表数据'}
                  </span>
                </div>
                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  💡 <strong>说明:</strong> 这是数据库保存后返回的完整数据,包括自动生成的ID、时间戳、以及关联的days和activities数据
                </div>
                <pre className="text-xs bg-white p-4 rounded border overflow-auto max-h-[300px]">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}

            {!result && !error && !loading && (
              <div className="text-center text-gray-400 py-12">
                <p>📊 提交数据后,结果将显示在这里</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2 text-blue-900">📖 使用说明</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>点击&quot;加载示例数据&quot;查看标准格式</li>
              <li>或粘贴从 Agent 提取的 JSON 数据</li>
              <li>点击&quot;提交并保存&quot;将数据存入数据库</li>
              <li>保存成功后可以到行程列表页面查看效果</li>
            </ol>
            <div className="mt-3 p-3 bg-white border border-blue-300 rounded space-y-2">
              <p className="text-xs text-blue-900">
                💡 <strong>提示:</strong> 这个工具会直接调用 <code>/api/itinerary-cards</code> API,
                与 Agent 保存数据的流程完全一致
              </p>
              <p className="text-xs text-blue-900">
                🔧 <strong>自动处理:</strong> 提交时会自动移除 <code>id</code>, <code>user_id</code>, 
                <code>created_at</code> 等数据库生成字段,系统会重新生成这些值
              </p>
              <p className="text-xs text-blue-900">
                📊 <strong>返回数据:</strong> 保存成功后会返回完整的数据库记录,包括自动生成的ID、
                时间戳、以及关联的days和activities数据
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
