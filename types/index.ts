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

// 费用相关类型
export interface Budget {
  total: number
  categories: {
    transportation: number
    accommodation: number
    food: number
    activities: number
    shopping: number
  }
  currency: string
}

export interface Expense {
  id: string
  itineraryId: string
  amount: number
  category: ExpenseCategory
  description: string
  date: string
  location?: string
  receiptUrl?: string
  currency: string
}

export type ExpenseCategory = 'transportation' | 'accommodation' | 'food' | 'activities' | 'shopping'

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
  id: string
  userId: string
  title?: string
  itineraryId?: string
  userPreferences: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentRun {
  id: string
  sessionId: string
  userMessage: string
  context: {
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
  itemType: string
  details: any
  destination?: string
  travelDate?: string
}

export interface CostEstimateOutput {
  item: string
  estimatedCost: string
  details?: string
  reasoning: string
  lowHighRange?: [number, number]
  currency?: string
}

// 旅行计划卡片 (结构化输出)
export interface ItineraryCard {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  preferences: string[]
  totalBudget?: number
  estimatedCost?: {
    total: number
    breakdown: Array<{
      category: 'transport' | 'accommodation' | 'food' | 'activity'
      amount: number
      notes?: string
    }>
  }
  days: Array<{
    date: string
    summary: string
    segments: Array<{
      time: string
      type: 'transport' | 'activity' | 'meal' | 'rest'
      title: string
      location: string
      description: string
      costEstimate?: number
      distanceInfo?: {
        from: string
        to: string
        mode: string
        duration: string
        distance: string
      }
    }>
  }>
  pendingQuestions?: string[]
  rawPlan?: string
}
