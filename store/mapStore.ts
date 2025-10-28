import { create } from 'zustand'
import type { Location, POI, Route } from '@/types'

interface MapState {
  // 地图视口状态
  center: Location
  zoom: number
  
  // POI 相关
  selectedPOI: POI | null
  searchResults: POI[]
  markers: POI[]
  
  // 路线相关
  currentRoute: Route | null
  routeOrigin: Location | null
  routeDestination: Location | null
  
  // 加载状态
  isSearching: boolean
  isLoadingRoute: boolean
  
  // 地图控制
  isMapLoaded: boolean
  
  // Actions
  setCenter: (center: Location) => void
  setZoom: (zoom: number) => void
  setSelectedPOI: (poi: POI | null) => void
  setSearchResults: (results: POI[]) => void
  addMarker: (poi: POI) => void
  removeMarker: (poiId: string) => void
  clearMarkers: () => void
  setCurrentRoute: (route: Route | null) => void
  setRouteOrigin: (origin: Location | null) => void
  setRouteDestination: (destination: Location | null) => void
  setIsSearching: (isSearching: boolean) => void
  setIsLoadingRoute: (isLoading: boolean) => void
  setIsMapLoaded: (isLoaded: boolean) => void
  reset: () => void
}

const initialState = {
  center: { lat: 39.9042, lng: 116.4074 }, // 北京天安门
  zoom: 12,
  selectedPOI: null,
  searchResults: [],
  markers: [],
  currentRoute: null,
  routeOrigin: null,
  routeDestination: null,
  isSearching: false,
  isLoadingRoute: false,
  isMapLoaded: false,
}

export const useMapStore = create<MapState>((set) => ({
  ...initialState,
  
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedPOI: (poi) => set({ selectedPOI: poi }),
  setSearchResults: (results) => set({ searchResults: results }),
  
  addMarker: (poi) =>
    set((state) => ({
      markers: [...state.markers.filter(m => m.id !== poi.id), poi],
    })),
  
  removeMarker: (poiId) =>
    set((state) => ({
      markers: state.markers.filter(m => m.id !== poiId),
    })),
  
  clearMarkers: () => set({ markers: [] }),
  
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setRouteOrigin: (origin) => set({ routeOrigin: origin }),
  setRouteDestination: (destination) => set({ routeDestination: destination }),
  
  setIsSearching: (isSearching) => set({ isSearching }),
  setIsLoadingRoute: (isLoading) => set({ isLoadingRoute: isLoading }),
  setIsMapLoaded: (isLoaded) => set({ isMapLoaded: isLoaded }),
  
  reset: () => set(initialState),
}))
