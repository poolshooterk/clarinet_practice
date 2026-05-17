import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import PracticeLogScreen from '@/app/(tabs)/index';
import { today } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const THIS_MONTH = today().slice(0, 7);
const [ty, tm] = THIS_MONTH.split('-').map(Number);
const prevDate = new Date(ty, tm - 2, 1);
const PREV_MONTH = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

const THIS_DATE = `${THIS_MONTH}-15`;
const PREV_DATE = `${PREV_MONTH}-10`;

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

const makeSession = (id: string, practicedAt: string, durationMinutes: number | null = null) => ({
  id,
  practicedAt,
  durationMinutes,
  otherMinutes: null,
  memo: null,
  textbookEntries: [],
  basicMenuEntries: [],
});

describe('PracticeLogScreen (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePracticeLogStore.setState({
      sessions: [makeSession('s1', THIS_DATE, 30), makeSession('s2', PREV_DATE, 45)],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('初期表示で今月の日付が見える', () => {
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.getByText(new RegExp(THIS_DATE))).toBeTruthy();
  });

  it('初期表示で前月の日付は見えない', () => {
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.queryByText(new RegExp(PREV_DATE))).toBeNull();
  });

  it('月ラベルに今月が表示される', () => {
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.getByText(formatMonthLabel(THIS_MONTH))).toBeTruthy();
  });

  it('＜ を押すと前月のラベルが表示され前月の記録が見える', async () => {
    renderWithProviders(<PracticeLogScreen />);
    fireEvent.press(screen.getByLabelText('前月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(PREV_MONTH))).toBeTruthy();
      expect(screen.getByText(new RegExp(PREV_DATE))).toBeTruthy();
    });
    expect(screen.queryByText(new RegExp(THIS_DATE))).toBeNull();
  });

  it('前月から ＞ を押すと今月に戻る', async () => {
    renderWithProviders(<PracticeLogScreen />);
    fireEvent.press(screen.getByLabelText('前月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(PREV_MONTH))).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('次月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(THIS_MONTH))).toBeTruthy();
    });
  });

  it('今月のとき ＞ を押しても月は変わらない', async () => {
    renderWithProviders(<PracticeLogScreen />);
    fireEvent.press(screen.getByLabelText('次月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(THIS_MONTH))).toBeTruthy();
    });
  });

  it('今月に記録がある場合は PracticeChart が描画される', () => {
    usePracticeLogStore.setState({
      sessions: [makeSession('s1', THIS_DATE, 30)],
      loading: false,
    });
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.getByLabelText('月別練習グラフ')).toBeTruthy();
  });

  it('今月に記録がない場合は PracticeChart が描画されない', () => {
    usePracticeLogStore.setState({
      sessions: [makeSession('s2', PREV_DATE, 45)],
      loading: false,
    });
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.queryByLabelText('月別練習グラフ')).toBeNull();
  });
});
