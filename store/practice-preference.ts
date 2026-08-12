import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AutoStartMenu } from '@/forms/practice-log';

type PracticePreferenceState = {
  autoStartMenu: AutoStartMenu;
  setAutoStartMenu: (v: AutoStartMenu) => void;
};

export const usePracticePreferenceStore = create<PracticePreferenceState>()(
  persist(
    (set) => ({
      autoStartMenu: 'none',
      setAutoStartMenu: (v) => set({ autoStartMenu: v }),
    }),
    {
      name: 'clarinet-practice-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
