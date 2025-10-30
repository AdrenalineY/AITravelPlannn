import { create } from 'zustand'

interface VoiceState {
  isRecording: boolean
  transcript: string
  isProcessing: boolean
  error: string | null
  setIsRecording: (isRecording: boolean) => void
  setTranscript: (transcript: string) => void
  appendTranscript: (text: string) => void
  setIsProcessing: (isProcessing: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  transcript: '',
  isProcessing: false,
  error: null,
  setIsRecording: (isRecording) => set({ isRecording }),
  setTranscript: (transcript) => set({ transcript }),
  appendTranscript: (text) => set((state) => ({ transcript: state.transcript + text })),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      isRecording: false,
      transcript: '',
      isProcessing: false,
      error: null,
    }),
}))
