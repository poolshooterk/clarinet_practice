import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped';

export type TimerEntry = {
  status: TimerStatus;
  accumulatedMs: number;
  startedAt: number | null;
};

type TimerState = {
  timers: Record<string, TimerEntry>;
  start: (key: string) => void;
  pause: (key: string) => void;
  stop: (key: string) => number;
  reset: (key: string) => void;
  resetAll: () => void;
};

const defaultEntry: TimerEntry = { status: 'idle', accumulatedMs: 0, startedAt: null };

export function getElapsedMs(entry: TimerEntry): number {
  if (entry.status === 'running' && entry.startedAt != null) {
    return entry.accumulatedMs + (Date.now() - entry.startedAt);
  }
  return entry.accumulatedMs;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: {},

      start: (key) =>
        set((state) => ({
          timers: {
            ...state.timers,
            [key]: {
              ...(state.timers[key] ?? defaultEntry),
              status: 'running',
              startedAt: Date.now(),
            },
          },
        })),

      pause: (key) =>
        set((state) => {
          const entry = state.timers[key] ?? defaultEntry;
          if (entry.status !== 'running') return state;
          const elapsed = entry.startedAt != null ? Date.now() - entry.startedAt : 0;
          return {
            timers: {
              ...state.timers,
              [key]: {
                status: 'paused',
                accumulatedMs: entry.accumulatedMs + elapsed,
                startedAt: null,
              },
            },
          };
        }),

      stop: (key) => {
        const entry = get().timers[key] ?? defaultEntry;
        const elapsed =
          entry.status === 'running' && entry.startedAt != null ? Date.now() - entry.startedAt : 0;
        const totalMs = entry.accumulatedMs + elapsed;
        const minutes = Math.max(1, Math.ceil(totalMs / 60000));
        set((state) => ({
          timers: {
            ...state.timers,
            [key]: { status: 'stopped', accumulatedMs: totalMs, startedAt: null },
          },
        }));
        return minutes;
      },

      reset: (key) =>
        set((state) => ({
          timers: { ...state.timers, [key]: { ...defaultEntry } },
        })),

      resetAll: () => set({ timers: {} }),
    }),
    {
      name: 'clarinet-practice-timers',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
