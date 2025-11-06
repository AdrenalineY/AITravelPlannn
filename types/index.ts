// 用户相关类型
export interface User {
  id: string
  email: string
  displayName?: string
  avatar?: string
  locale: string
  currency: string
  isNewUser: boolean
  lastLoginAt: string
  createdAt: string
  configStatus?: ConfigStatus
}

export interface UserProfile {
  displayName?: string
  avatar?: string
  locale?: string
  currency?: string
}

// 用户旅行偏好配置
export interface TravelPreferencesProfile {
  gender?: 'male' | 'female' | 'other'     // 性别
  age?: number                               // 年龄
  city?: string                              // 居住城市
  personalInterests?: string                 // 个人喜好（自由文本，最多2000字符）
}

// API 配置相关类型
export interface APIConfig {
  llm: {
    provider: 'aliyun' | 'openai' | 'baidu'
    apiKey: string
    baseUrl?: string
    model?: string
  }
  speech: {
    provider: 'xunfei' | 'baidu' | 'aliyun'
    apiKey: string
    appId?: string
    apiSecret?: string
  }
  map: {
    provider: 'amap' | 'baidu'
    webServiceKey: string     // Web服务 API Key (用于后端数据获取)
    jsApiKey: string           // Web端(JS API) Key (用于前端地图显示)
    securityCode?: string      // 安全密钥 (可选,用于 JS API 安全验证)
  }
}

export interface ConfigStatus {
  hasLLMConfig: boolean
  hasSpeechConfig: boolean
  hasMapConfig: boolean
  isConfigComplete: boolean
  missingConfigs: string[]
}

export interface ConfigProgress {
  totalSteps: number
  completedSteps: number
  currentStep: string
  nextStep?: string
  isComplete: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors?: Record<string, string>
  warnings?: Record<string, string>
}

// 行程相关类型
export interface Itinerary {
  id: string
  userId: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  days: DayPlan[]
  preferences: TravelPreferences
  status: 'draft' | 'confirmed' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface DayPlan {
  id: string
  date: string
  activities: Activity[]
  transportation: Transportation[]
  accommodation?: Accommodation
  totalCost: number
  summary?: string
}

export interface Activity {
  id: string
  order: number
  time: string
  poiId?: string
  poiName: string
  address: string
  notes?: string
  cost: number
}

export interface Transportation {
  id: string
  mode: 'walk' | 'bus' | 'subway' | 'taxi' | 'car' | 'flight' | 'train'
  from: string
  to: string
  duration: number
  cost: number
}

export interface Accommodation {
  id: string
  name: string
  address: string
  checkIn: string
  checkOut: string
  cost: number
}

export interface TravelPreferences {
  travelStyle?: string
  companions?: string
  budgetMin?: number
  budgetMax?: number
  interestTags: string[]
}

// 地图相关类型
export interface Location {
  lat: number
  lng: number
}

export interface POI {
  id: string
  name: string
  category: string
  location: Location
  rating?: number
  photos?: string[]
  description?: string
  openHours?: string
  address?: string
}

export interface POIDetail extends POI {
  reviews?: Review[]
  amenities?: string[]
  price?: string
}

export interface Route {
  distance: number
  duration: number
  polyline: string
  steps: RouteStep[]
}

export interface RouteStep {
  instruction: string
  distance: number
  duration: number
}

export interface Review {
  id: string
  rating: number
  content: string
  author: string
  date: string
}

// 语音相关类型
export interface TranscriptionResult {
  text: string
  confidence: number
  intent?: VoiceIntent
  entities?: Record<string, any>
}

export interface VoiceIntent {
  action: 'create_itinerary' | 'modify_itinerary' | 'add_expense' | 'search_poi'
  parameters: Record<string, any>
}

// 费用相关类型 - 统一的五大类别
export type CostCategory = 'transport' | 'ticket' | 'accommodation' | 'meal' | 'shopping'

export interface Budget {
  total: number
  categories: {
    transport: number      // 交通
    ticket: number         // 门票
    accommodation: number  // 住宿
    meal: number          // 餐饮
    shopping: number      // 购物
  }
  currency: string
}

export interface Expense {
  id: string
  itineraryId: string
  amount: number
  category: CostCategory
  description: string
  date: string
  location?: string
  receiptUrl?: string
  currency: string
}

export type ExpenseCategory = CostCategory  // 向后兼容

export interface ExpenseAnalytics {
  totalsByCategory: Record<ExpenseCategory, number>
  dailySpend: Array<{ date: string; amount: number }>
  averageDaily: number
  remainingBudget: number
}

// AI 服务相关类型
export interface TravelRequirements {
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget?: number
  preferences?: TravelPreferences
  additionalNotes?: string
}

export interface ChatContext {
  itineraryId?: string
  conversationHistory: ChatMessage[]
  userPreferences?: TravelPreferences
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    type?: 'normal' | 'agent_thought' | 'agent_action' | 'agent_observation' | 'agent_answer'
    agentRunId?: string
    toolName?: string
    toolInput?: string
  }
}

// ========== ReAct Agent 相关类型 ==========

export interface ConversationSession {
  id?: string  // 兼容旧代码
  sessionGroupId: string  // 🔄 重构: 使用 session_group_id
  userId: string
  title?: string
  destination?: string  // 🔄 新增: 目标目的地
  itineraryId?: string  // 兼容旧代码
  userPreferences?: Record<string, any>  // 兼容旧代码
  isActive?: boolean  // 兼容旧代码
  createdAt: string
  updatedAt: string
  messageCount?: number  // 🔄 新增: 消息数量
  messages?: Array<{  // 🔄 新增: 对话历史
    user: string
    assistant: string
  }>
  // 🔥 数据同步修复相关字段
  rebuiltFromItinerary?: boolean  // 标记是否从行程卡片重建
  naturalPlan?: string  // 自然语言行程描述
}

export interface AgentRun {
  id: string
  sessionGroupId: string  // 🔄 重构: 使用 session_group_id
  sessionTitle?: string   // 🔄 新增: 会话标题
  targetDestination?: string  // 🔄 新增: 目标目的地
  userMessage: string
  contextData: {  // 🔄 重构: context → contextData
    conversationHistory: Array<{ role: string; content: string }>
    userPreferences: Record<string, any>
    currentPlan?: any
  }
  finalAnswer?: string
  planExtracted?: ItineraryCard
  status: 'running' | 'completed' | 'error'
  errorMessage?: string
  turnCount: number
  createdAt: string
  completedAt?: string
}

export interface AgentMessage {
  id: string
  agentRunId: string
  turnNumber: number
  messageType: 'thought' | 'action' | 'observation' | 'answer'
  content: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface AgentToolCall {
  id: string
  agentRunId: string
  turnNumber: number
  toolName: string
  toolInput: string
  toolOutput?: string
  observation?: string
  executionTimeMs?: number
  createdAt: string
}

export interface AgentAction {
  action: string
  actionInput: string
}

export interface ToolResult {
  observation: string
  payload?: any
  error?: string
}

// Agent 工具调用的输入输出类型
export interface DistanceToolInput {
  origin: string
  destination: string
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling'
}

export interface DistanceToolOutput {
  distance: string
  duration: string
  cost?: string
  mode: string
  path?: Array<{ lng: number; lat: number }>
}

export interface POISearchInput {
  location: string
  category: 'attraction' | 'restaurant' | 'hotel'
  radius?: number
  keyword?: string
}

export interface POISearchOutput {
  location: string
  category: string
  results: Array<{
    name: string
    type: string
    rating?: number
    address?: string
    priceLevel?: string
    priceRange?: string
  }>
  count: number
}

export interface CostEstimateInput {
  category: 'transport' | 'ticket' | 'accommodation' | 'meal' | 'shopping'  // 费用类别
  nodeType: string      // 节点类型
  location: string      // 地点
  name: string          // 节点名称
  details?: string      // 补充信息
  quantity?: number     // 数量/人数
  date?: string         // 日期
  [key: string]: any    // 其他参数
}

export interface CostEstimateOutput {
  item: string          // 项目名称
  category: 'transport' | 'ticket' | 'accommodation' | 'meal' | 'shopping'  // 费用类别
  amount: number        // 具体金额
  basePrice?: number    // 单价
  quantity?: number     // 数量
  breakdown?: Array<{   // 费用明细
    item: string
    amount: number
  }>
  estimatedCost: string // 格式化的费用描述(如"60元")
  details?: string      // 详细说明
  reasoning: string     // 估算依据
  currency?: string     // 货币单位
}

// 旅行计划卡片 (结构化输出) - 增强版
export interface ItineraryCard {
  // 基本信息
  id: string
  sessionGroupId?: string  // 🔄 重构: 关联的会话分组ID (替代 sessionId)
  userId?: string     // 用户ID
  title: string       // 行程标题
  destination: string // 主要目的地
  cities?: string[]   // 涉及的城市列表
  
  // 时间信息
  startDate?: string | null  // 开始日期 YYYY-MM-DD (可选,待确定)
  endDate?: string | null    // 结束日期 YYYY-MM-DD (可选,待确定)
  totalDays?: number | null  // 总天数(从日期计算,可能为空)
  totalNights?: number | null // 总晚数(从日期计算,可能为空)
  durationDays?: number      // 行程天数(独立字段,如"3天2晚"中的3)
  durationNights?: number    // 行程晚数(独立字段,如"3天2晚"中的2)
  
  // 人员信息
  travelers: number          // 出行人数
  travelersDetail?: {        // 出行人员详情
    adults: number
    children?: number
    infants?: number
    ages?: number[]
  }
  
  // 偏好与主题
  preferences: string[]      // 旅行偏好标签 ['美食', '历史', '自然']
  travelStyle?: string       // 旅行风格 '休闲'|'紧凑'|'深度游'
  specialRequests?: string[] // 特殊需求 ['素食', '无障碍', '亲子']
  theme?: string             // 行程主题 '蜜月'|'亲子'|'毕业旅行'
  
  // 预算信息
  totalBudget?: number       // 总预算
  budgetPerPerson?: number   // 人均预算
  currency?: string          // 货币单位 'CNY'|'USD'
  estimatedCost?: {
    total: number            // 总费用
    perPerson: number        // 人均费用
    breakdown: Array<{
      category: 'transport' | 'ticket' | 'accommodation' | 'meal' | 'shopping'  // 统一五大类
      amount: number         // 该类别总金额
      percentage?: number    // 占总预算的比例 (0-100)
      notes?: string         // 说明
      items?: Array<{        // 该类别下的明细项
        name: string         // 项目名称
        amount: number       // 单项金额
        quantity?: number    // 数量
        dayNumber?: number   // 所属天数
      }>
    }>
  }
  
  // 住宿信息
  accommodation?: {
    region: string             // 住宿区域
    type?: string              // 酒店类型
    recommendations?: Array<{
      name: string
      location: string
      rating?: number
      pricePerNight: number
      totalNights: number
      totalCost: number
      amenities?: string[]
      bookingUrl?: string
    }>
  }
  
  // 每日行程
  days: Array<{
    dayNumber: number          // 第几天
    date: string               // 日期 YYYY-MM-DD
    title?: string             // 当日标题 '故宫-长城一日游'
    summary: string            // 当日概要
    highlights?: string[]      // 当日亮点
    totalDistance?: number     // 当日总距离(km)
    totalDuration?: number     // 当日总时长(分钟)
    segments: Array<{
      order: number            // 顺序
      time: string             // 时间 'HH:mm' 或 'HH:mm-HH:mm'
      timePeriod?: 'morning' | 'afternoon' | 'evening' | 'night'  // 时段
      type: 'transport' | 'activity' | 'meal' | 'rest' | 'accommodation'
      title: string            // 标题
      location: string         // 地点
      address?: string         // 详细地址
      coordinates?: {          // 坐标
        lng: number
        lat: number
      }
      description: string      // 描述
      duration?: number        // 时长(分钟)
      costEstimate?: number    // 费用估算 (该节点的总费用)
      costCategory?: 'transport' | 'ticket' | 'accommodation' | 'meal' | 'shopping'  // 费用类别
      costDetails?: {          // 费用明细 (可选)
        basePrice?: number     // 基础价格
        quantity?: number      // 数量 (如人数)
        breakdown?: Array<{    // 细分项 (可选)
          item: string         // 项目名
          amount: number       // 金额
        }>
        notes?: string         // 费用说明
      }
      rating?: number          // 评分
      tips?: string[]          // 小贴士
      // 用餐信息 (当 type='meal' 时)
      mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
      cuisine?: string         // 菜系
      restaurant?: string      // 餐厅名称
      signature?: string[]     // 招牌菜
      // 交通信息 (当 type='transport' 时)
      transportMode?: 'walk' | 'subway' | 'bus' | 'taxi' | 'car' | 'flight' | 'train' | 'bike' | 'ship'
      transportDetails?: {
        from: string
        to: string
        duration?: string
        distance?: string
        cost?: number
        departureTime?: string
        arrivalTime?: string
        notes?: string
      }
      distanceInfo?: {
        from: string
        to: string
        mode: 'walk' | 'subway' | 'bus' | 'taxi' | 'car' | 'flight' | 'train'
        duration: string
        distance: string
        cost?: number
      }
      bookingInfo?: {          // 预订信息
        required: boolean      // 是否需要预订
        advanceTime?: string   // 提前预订时间
        bookingUrl?: string    // 预订链接
        contact?: string       // 联系方式
      }
    }>
  }>
  
  // 实用建议
  tips?: {
    bestTime?: string          // 最佳旅行时间
    weather?: string           // 天气提示
    transportation?: string[]  // 交通建议
    packing?: string[]         // 打包清单
    safety?: string[]          // 安全提示
    cultural?: string[]        // 文化习俗
    emergencyContact?: string  // 紧急联系方式
  }
  
  // 美食推荐
  foodRecommendations?: Array<{
    name: string
    location: string
    cuisine: string            // 菜系
    signature?: string[]       // 招牌菜
    avgCost: number
    rating?: number
    mustTry?: boolean
  }>
  
  // 购物推荐
  shoppingSpots?: Array<{
    name: string
    location: string
    category: string           // 类别 '商场'|'特色街'|'免税店'
    description?: string
    highlights?: string[]
  }>
  
  // 交通总览
  transportationSummary?: {
    interCity?: Array<{        // 城际交通
      from: string
      to: string
      mode: string
      departureTime?: string
      arrivalTime?: string
      cost: number
      bookingInfo?: string
    }>
    localTransport?: {         // 当地交通
      mainModes: string[]      // 主要交通方式
      cards?: string[]         // 交通卡建议
      estimatedCost: number
    }
  }
  
  // 待确认事项
  pendingQuestions?: string[]
  
  // 元数据
  rawPlan?: string               // 原始自然语言计划(前500字)
  fullPlan?: string              // 完整自然语言计划
  planDescription?: string       // Agent最后一次输出的完整旅行计划自然语言描述
  status?: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  tags?: string[]                // 标签
  shareUrl?: string              // 分享链接
  coverImage?: string            // 封面图
  isPublic?: boolean             // 是否公开
  createdAt?: string
  updatedAt?: string
  version?: number               // 版本号(用于行程修改历史)
}
