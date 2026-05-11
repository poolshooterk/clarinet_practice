import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PurchasePlan } from '@/forms/purchase-plan';
import { usePurchasePlanStore } from '@/store/purchase-plan';

const STORAGE_KEY = 'clarinet-practice-purchase-plan';

const samplePlan: PurchasePlan = {
  makerId: 'maker-1',
  makerName: 'Buffet Crampon',
  modelId: 'model-1',
  modelName: 'R13',
  targetPrice: 850000,
  currentSavings: 200000,
  monthlySavings: 30000,
};

describe('usePurchasePlanStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePurchasePlanStore.setState({ plan: null });
  });

  it('初期状態は null', () => {
    expect(usePurchasePlanStore.getState().plan).toBeNull();
  });

  it('setPlan でストア状態が更新される', () => {
    usePurchasePlanStore.getState().setPlan(samplePlan);
    expect(usePurchasePlanStore.getState().plan).toEqual(samplePlan);
  });

  it('setPlan で AsyncStorage に書き込まれる', async () => {
    usePurchasePlanStore.getState().setPlan(samplePlan);
    await new Promise((r) => setImmediate(r));

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.plan).toEqual(samplePlan);
  });

  it('rehydrate で AsyncStorage の値が復元される', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { plan: samplePlan }, version: 0 }),
    );
    await usePurchasePlanStore.persist.rehydrate();
    expect(usePurchasePlanStore.getState().plan).toEqual(samplePlan);
  });
});
