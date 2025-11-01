import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Itinerary, ChatMessage, TravelPreferences, ConversationSession, AgentMessage, ItineraryCard } from '@/types'

interface ItineraryState {
  // 当前行程
  currentItinerary: Itinerary | null
  
  // 行程列表
  itineraries: Itinerary[]
  
  // 对话状态
  chatMessages: ChatMessage[]
  isGenerating: boolean
  
  // 用户偏好
  preferences: TravelPreferences | null
  
  // 编辑状态
  isEditing: boolean
  editingDayIndex: number | null
  
  // 加载状态
  isLoadingItinerary: boolean
  isSaving: boolean

  // ========== Agent 相关状态 ==========
  // 当前会话
  currentSession: ConversationSession | null
  // Agent 运行状态
  isAgentRunning: boolean
  // Agent 消息流
  agentMessages: AgentMessage[]
  // 当前 Agent 运行 ID
  currentAgentRunId: string | null
  // 待确认问题
  pendingQuestions: string[]
  // 提取的行程卡片
  extractedPlanCard: ItineraryCard | null
  
  // Actions
  setCurrentItinerary: (itinerary: Itinerary | null) => void
  setItineraries: (itineraries: Itinerary[]) => void
  addItinerary: (itinerary: Itinerary) => void
  updateItinerary: (id: string, updates: Partial<Itinerary>) => void
  deleteItinerary: (id: string) => void
  
  addChatMessage: (message: ChatMessage) => void
  clearChatMessages: () => void
  setIsGenerating: (isGenerating: boolean) => void
  
  setPreferences: (preferences: TravelPreferences) => void
  
  setIsEditing: (isEditing: boolean) => void
  setEditingDayIndex: (index: number | null) => void
  
  setIsLoadingItinerary: (isLoading: boolean) => void
  setIsSaving: (isSaving: boolean) => void
  
  // Agent Actions
  setCurrentSession: (session: ConversationSession | null) => void
  setIsAgentRunning: (isRunning: boolean) => void
  setAgentMessages: (messages: AgentMessage[]) => void
  addAgentMessage: (message: AgentMessage) => void
  setCurrentAgentRunId: (runId: string | null) => void
  setPendingQuestions: (questions: string[]) => void
  setExtractedPlanCard: (card: ItineraryCard | null) => void
  clearAgentState: () => void
  
  reset: () => void
}

const initialState = {
  currentItinerary: null,
  itineraries: [],
  chatMessages: [],
  isGenerating: false,
  preferences: null,
  isEditing: false,
  editingDayIndex: null,
  isLoadingItinerary: false,
  isSaving: false,
  // Agent state
  currentSession: null,
  isAgentRunning: false,
  agentMessages: [],
  currentAgentRunId: null,
  pendingQuestions: [],
  extractedPlanCard: null,
}

export const useItineraryStore = create<ItineraryState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setCurrentItinerary: (itinerary) => set({ currentItinerary: itinerary }),
      
      setItineraries: (itineraries) => set({ itineraries }),
      
      addItinerary: (itinerary) =>
        set((state) => ({
          itineraries: [itinerary, ...state.itineraries],
          currentItinerary: itinerary,
        })),
      
      updateItinerary: (id, updates) =>
        set((state) => {
          const updatedItineraries = state.itineraries.map((it) =>
            it.id === id ? { ...it, ...updates, updatedAt: new Date().toISOString() } : it
          )
          const updatedCurrent =
            state.currentItinerary?.id === id
              ? { ...state.currentItinerary, ...updates, updatedAt: new Date().toISOString() }
              : state.currentItinerary
          return {
            itineraries: updatedItineraries,
            currentItinerary: updatedCurrent,
          }
        }),
      
      deleteItinerary: (id) =>
        set((state) => ({
          itineraries: state.itineraries.filter((it) => it.id !== id),
          currentItinerary: state.currentItinerary?.id === id ? null : state.currentItinerary,
        })),
      
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
      
      clearChatMessages: () => set({ chatMessages: [] }),
      
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      
      setPreferences: (preferences) => set({ preferences }),
      
      setIsEditing: (isEditing) => set({ isEditing }),
      setEditingDayIndex: (index) => set({ editingDayIndex: index }),
      
      setIsLoadingItinerary: (isLoading) => set({ isLoadingItinerary: isLoading }),
      setIsSaving: (isSaving) => set({ isSaving }),
      
      // Agent Actions
      setCurrentSession: (session) => set({ currentSession: session }),
      setIsAgentRunning: (isRunning) => set({ isAgentRunning: isRunning }),
      setAgentMessages: (messages) => set({ agentMessages: messages }),
      addAgentMessage: (message) =>
        set((state) => ({
          agentMessages: [...state.agentMessages, message],
        })),
      setCurrentAgentRunId: (runId) => set({ currentAgentRunId: runId }),
      setPendingQuestions: (questions) => set({ pendingQuestions: questions }),
      setExtractedPlanCard: (card) => set({ extractedPlanCard: card }),
      clearAgentState: () =>
        set({
          isAgentRunning: false,
          agentMessages: [],
          currentAgentRunId: null,
          pendingQuestions: [],
        }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'itinerary-storage',
      partialize: (state) => ({
        currentItinerary: state.currentItinerary,
        itineraries: state.itineraries,
        preferences: state.preferences,
      }),
    }
  )
)
