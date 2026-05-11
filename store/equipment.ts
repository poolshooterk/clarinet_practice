import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ClarinetEquipment } from '@/forms/equipment';

type EquipmentState = {
  equipment: ClarinetEquipment | null;
  setEquipment: (e: ClarinetEquipment) => void;
};

export const useEquipmentStore = create<EquipmentState>()(
  persist(
    (set) => ({
      equipment: null,
      setEquipment: (e) => set({ equipment: e }),
    }),
    {
      name: 'clarinet-practice-equipment',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
