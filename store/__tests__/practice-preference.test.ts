import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePracticePreferenceStore } from '@/store/practice-preference';

const STORAGE_KEY = 'clarinet-practice-preference';

describe('usePracticePreferenceStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePracticePreferenceStore.setState({ autoStartMenu: 'none' });
  });

  describe('default state', () => {
    it('自動開始メニューの既定値は none', () => {
      expect(usePracticePreferenceStore.getState().autoStartMenu).toBe('none');
    });
  });

  describe('actions', () => {
    it('setAutoStartMenu が状態を更新する', () => {
      usePracticePreferenceStore.getState().setAutoStartMenu('long_tone');
      expect(usePracticePreferenceStore.getState().autoStartMenu).toBe('long_tone');
    });

    it('none へ戻せる', () => {
      usePracticePreferenceStore.getState().setAutoStartMenu('textbook');
      usePracticePreferenceStore.getState().setAutoStartMenu('none');
      expect(usePracticePreferenceStore.getState().autoStartMenu).toBe('none');
    });
  });

  describe('AsyncStorage persistence', () => {
    it('更新時に clarinet-practice-preference へ書き込む', async () => {
      usePracticePreferenceStore.getState().setAutoStartMenu('tonguing');
      await new Promise((r) => setImmediate(r));

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string).state.autoStartMenu).toBe('tonguing');
    });

    it('AsyncStorage から復元する', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ state: { autoStartMenu: 'other' }, version: 0 }),
      );

      await usePracticePreferenceStore.persist.rehydrate();

      expect(usePracticePreferenceStore.getState().autoStartMenu).toBe('other');
    });

    it('保存が無いときは既定値のまま', async () => {
      await AsyncStorage.clear();
      await usePracticePreferenceStore.persist.rehydrate();

      expect(usePracticePreferenceStore.getState().autoStartMenu).toBe('none');
    });

    it('壊れた JSON でも例外を投げない', async () => {
      await AsyncStorage.setItem(STORAGE_KEY, '{not valid json');

      await expect(usePracticePreferenceStore.persist.rehydrate()).resolves.not.toThrow();
    });
  });
});
