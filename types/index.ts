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
}
