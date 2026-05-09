import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SettingsState = {
  notify: boolean;
  volume: number;
  setNotify: (v: boolean) => void;
  setVolume: (v: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notify: true,
      volume: 40,
      setNotify: (v) => set({ notify: v }),
      setVolume: (v) => set({ volume: v }),
    }),
    {
      name: 'expo-template-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
