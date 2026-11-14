import { create } from "zustand";
import type { Site, Audience, QualityTier, LimbMode, BothWindow, ComparisonSite, ScoreBreakdown, ScoreWeights } from "./types";

interface AppState {
  sites: Site[];
  selectedSiteIds: string[];
  dateRange: { start: string; end: string };
  stepHours: number;
  audience: Audience;
  quality: QualityTier;
  limbMode: LimbMode;
  weights: ScoreWeights;
  playbackTimeIdx: number;
  isPlaying: boolean;
  playbackSpeed: number;
  bestWindows: BothWindow[];
  comparisonData: ComparisonSite[] | null;
  chatOpen: boolean;
  narratorOpen: boolean;
  reducedMotion: boolean;

  setSites: (sites: Site[]) => void;
  toggleSite: (id: string) => void;
  setDateRange: (range: { start: string; end: string }) => void;
  setStepHours: (hours: number) => void;
  setAudience: (audience: Audience) => void;
  setQuality: (quality: QualityTier) => void;
  setLimbMode: (mode: LimbMode) => void;
  setWeights: (weights: Partial<ScoreWeights>) => void;
  setPlaybackTimeIdx: (idx: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setBestWindows: (windows: BothWindow[]) => void;
  setComparisonData: (data: ComparisonSite[] | null) => void;
  setChatOpen: (open: boolean) => void;
  setNarratorOpen: (open: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  reset: () => void;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  sunlit: 0.45,
  darkness: 0.2,
  earth: 0.25,
  both: 0.1,
};

const DEFAULT_DATE_RANGE = {
  start: "2026-11-01T00:00:00Z",
  end: "2027-11-01T00:00:00Z",
};

export const useStore = create<AppState>()((set) => ({
    sites: [],
    selectedSiteIds: [],
    dateRange: DEFAULT_DATE_RANGE,
    stepHours: 1,
    audience: "public",
    quality: "auto",
    limbMode: "upper",
    weights: DEFAULT_WEIGHTS,
    playbackTimeIdx: 0,
    isPlaying: false,
    playbackSpeed: 1,
    bestWindows: [],
    comparisonData: null,
    chatOpen: false,
    narratorOpen: false,
    reducedMotion: false,

    setSites: (sites) => set({ sites }),
    toggleSite: (id) =>
      set((state) => {
        const selected = state.selectedSiteIds.includes(id)
          ? state.selectedSiteIds.filter((s) => s !== id)
          : state.selectedSiteIds.length < 4
          ? [...state.selectedSiteIds, id]
          : state.selectedSiteIds;
        return { selectedSiteIds: selected };
      }),
    setDateRange: (dateRange) => set({ dateRange }),
    setStepHours: (stepHours) => set({ stepHours }),
    setAudience: (audience) => set({ audience }),
    setQuality: (quality) => set({ quality }),
    setLimbMode: (limbMode) => set({ limbMode }),
    setWeights: (weights) =>
      set((state) => ({ weights: { ...state.weights, ...weights } })),
    setPlaybackTimeIdx: (playbackTimeIdx) => set({ playbackTimeIdx }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
    setBestWindows: (bestWindows) => set({ bestWindows }),
    setComparisonData: (comparisonData) => set({ comparisonData }),
    setChatOpen: (chatOpen) => set({ chatOpen }),
    setNarratorOpen: (narratorOpen) => set({ narratorOpen }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    reset: () =>
      set({
        selectedSiteIds: [],
        dateRange: DEFAULT_DATE_RANGE,
        stepHours: 1,
        audience: "public",
        quality: "auto",
        limbMode: "upper",
        weights: DEFAULT_WEIGHTS,
        playbackTimeIdx: 0,
        isPlaying: false,
        playbackSpeed: 1,
        bestWindows: [],
        comparisonData: null,
        chatOpen: false,
        narratorOpen: false,
      })
    })
  );

// For transient updates (playback time), use useStore.getState() directly
// or subscribe via useStore.subscribe in a useEffect
export const useTransientStore = useStore;