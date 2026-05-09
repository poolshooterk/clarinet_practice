import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '@/store/settings';

const STORAGE_KEY = 'expo-template-settings';

describe('useSettingsStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.setState({ notify: true, volume: 40 });
  });

  describe('default state', () => {
    it('exposes default notify=true / volume=40', () => {
      const s = useSettingsStore.getState();
      expect(s.notify).toBe(true);
      expect(s.volume).toBe(40);
    });
  });

  describe('actions', () => {
    it('setNotify mutates state', () => {
      useSettingsStore.getState().setNotify(false);
      expect(useSettingsStore.getState().notify).toBe(false);
    });

    it('setVolume mutates state', () => {
      useSettingsStore.getState().setVolume(75);
      expect(useSettingsStore.getState().volume).toBe(75);
    });

    it('setVolume preserves notify (partial update)', () => {
      useSettingsStore.getState().setVolume(10);
      expect(useSettingsStore.getState().notify).toBe(true);
    });
  });

  describe('AsyncStorage persistence', () => {
    it('writes to AsyncStorage under expo-template-settings on update', async () => {
      useSettingsStore.getState().setVolume(80);
      await new Promise((r) => setImmediate(r));

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string).state.volume).toBe(80);
    });

    it('persists both notify and volume together', async () => {
      useSettingsStore.getState().setNotify(false);
      useSettingsStore.getState().setVolume(25);
      await new Promise((r) => setImmediate(r));

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const persisted = JSON.parse(raw as string).state;
      expect(persisted.notify).toBe(false);
      expect(persisted.volume).toBe(25);
    });

    it('rehydrates state from AsyncStorage', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ state: { notify: false, volume: 90 }, version: 0 }),
      );

      await useSettingsStore.persist.rehydrate();

      const s = useSettingsStore.getState();
      expect(s.notify).toBe(false);
      expect(s.volume).toBe(90);
    });

    it('falls back to defaults when AsyncStorage has no entry', async () => {
      await AsyncStorage.clear();
      await useSettingsStore.persist.rehydrate();

      const s = useSettingsStore.getState();
      expect(s.notify).toBe(true);
      expect(s.volume).toBe(40);
    });

    it('does not throw on malformed persisted JSON', async () => {
      await AsyncStorage.setItem(STORAGE_KEY, '{not valid json');

      await expect(useSettingsStore.persist.rehydrate()).resolves.not.toThrow();
    });
  });
});
