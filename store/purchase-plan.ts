import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PurchasePlan } from '@/forms/purchase-plan';

type PurchasePlanState = {
  plan: PurchasePlan | null;
  setPlan: (plan: PurchasePlan) => void;
};

export const usePurchasePlanStore = create<PurchasePlanState>()(
  persist(
    (set) => ({
      plan: null,
      setPlan: (plan) => set({ plan }),
    }),
    {
      name: 'clarinet-practice-purchase-plan',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
