import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { APIConfig, ConfigProgress, ValidationResult } from '@/types'

interface ConfigState {
  config: APIConfig | null
  progress: ConfigProgress
  validationResults: Record<string, ValidationResult>
  isValidating: boolean
  isSaving: boolean
  setConfig: (config: APIConfig | null) => void
  updateConfig: (updates: Partial<APIConfig>) => void
  setProgress: (progress: ConfigProgress) => void
  setValidationResult: (key: string, result: ValidationResult) => void
  setIsValidating: (isValidating: boolean) => void
  setIsSaving: (isSaving: boolean) => void
  reset: () => void
}

const initialProgress: ConfigProgress = {
  totalSteps: 3,
  completedSteps: 0,
  currentStep: 'llm',
  nextStep: 'speech',
  isComplete: false,
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: null,
      progress: initialProgress,
      validationResults: {},
      isValidating: false,
      isSaving: false,
      setConfig: (config) => set({ config }),
      updateConfig: (updates) =>
        set((state) => ({
          config: state.config ? { ...state.config, ...updates } : null,
        })),
      setProgress: (progress) => set({ progress }),
      setValidationResult: (key, result) =>
        set((state) => ({
          validationResults: { ...state.validationResults, [key]: result },
        })),
      setIsValidating: (isValidating) => set({ isValidating }),
      setIsSaving: (isSaving) => set({ isSaving }),
      reset: () =>
        set({
          config: null,
          progress: initialProgress,
          validationResults: {},
          isValidating: false,
          isSaving: false,
        }),
    }),
    {
      name: 'config-storage',
      partialize: (state) => ({
        config: state.config,
        progress: state.progress,
      }),
    }
  )
)
