import AsyncStorage from '@react-native-async-storage/async-storage';

import { useEquipmentStore } from '@/store/equipment';

const STORAGE_KEY = 'clarinet-practice-equipment';

const sampleEquipment = {
  instrument: { name: 'B♭クラリネット', startDate: '2020-04-01' },
  reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
  ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
  mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
};

describe('useEquipmentStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useEquipmentStore.setState({ equipment: null });
  });

  it('初期状態は null', () => {
    expect(useEquipmentStore.getState().equipment).toBeNull();
  });

  it('setEquipment でストア状態が更新される', () => {
    useEquipmentStore.getState().setEquipment(sampleEquipment);
    expect(useEquipmentStore.getState().equipment).toEqual(sampleEquipment);
  });

  it('setEquipment で AsyncStorage に書き込まれる', async () => {
    useEquipmentStore.getState().setEquipment(sampleEquipment);
    await new Promise((r) => setImmediate(r));

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.equipment).toEqual(sampleEquipment);
  });

  it('rehydrate で AsyncStorage の値が復元される', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { equipment: sampleEquipment }, version: 0 }),
    );
    await useEquipmentStore.persist.rehydrate();
    expect(useEquipmentStore.getState().equipment).toEqual(sampleEquipment);
  });

  it('AsyncStorage にエントリがなければデフォルト null', async () => {
    await AsyncStorage.clear();
    await useEquipmentStore.persist.rehydrate();
    expect(useEquipmentStore.getState().equipment).toBeNull();
  });

  it('破損した JSON でも例外をスローしない', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not valid json');
    await expect(useEquipmentStore.persist.rehydrate()).resolves.not.toThrow();
  });
});
