import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { SettingsCard } from '@/components/settings-card';
import { useSettingsStore } from '@/store/settings';
import { renderWithProviders, screen } from '@/test-utils/render';

const STORAGE_KEY = 'expo-template-settings';

describe('SettingsCard (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.setState({ notify: true, volume: 40 });
  });

  it('reflects current store state on mount', () => {
    useSettingsStore.setState({ notify: false, volume: 88 });
    renderWithProviders(<SettingsCard />);

    expect(screen.getByTestId('settings-volume-value').props.children).toBe(88);
  });

  it('toggling notify Switch updates the store and persists to AsyncStorage', async () => {
    renderWithProviders(<SettingsCard />);

    fireEvent.press(screen.getByLabelText('通知を切り替え'));

    expect(useSettingsStore.getState().notify).toBe(false);

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string).state.notify).toBe(false);
    });
  });

  it('external store updates re-render the volume label', () => {
    renderWithProviders(<SettingsCard />);

    expect(screen.getByTestId('settings-volume-value').props.children).toBe(40);

    act(() => {
      useSettingsStore.getState().setVolume(75);
    });

    expect(screen.getByTestId('settings-volume-value').props.children).toBe(75);
  });

  it('writes both notify and volume to AsyncStorage when actions are dispatched', async () => {
    renderWithProviders(<SettingsCard />);

    act(() => {
      useSettingsStore.getState().setVolume(63);
      useSettingsStore.getState().setNotify(false);
    });

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw as string).state;
      expect(parsed.volume).toBe(63);
      expect(parsed.notify).toBe(false);
    });

    expect(screen.getByTestId('settings-volume-value').props.children).toBe(63);
  });
});
