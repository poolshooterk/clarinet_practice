import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';

import LessonScreen from '@/app/(tabs)/lesson';
import { useLessonRecordStore } from '@/store/lesson-record';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
  getRecordingUri: jest.fn((id: string) => `file:///recordings/${id}.m4a`),
  createSound: jest.fn(),
  loadRecordedIds: jest.fn().mockResolvedValue(new Set()),
}));

describe('LessonScreen (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: 'タンギングを軽く',
          notes: null,
          textbookEntries: [],
        },
      ],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('記録がある場合にアドバイスのテキストがカードに表示される', () => {
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText('タンギングを軽く')).toBeTruthy();
  });

  it('空状態では「記録がまだありません」が表示される', () => {
    useLessonRecordStore.setState({ records: [], loading: false });
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText('記録がまだありません')).toBeTruthy();
  });

  it('カードをタップすると編集フォームへ遷移する', () => {
    renderWithProviders(<LessonScreen />);
    fireEvent.press(screen.getByLabelText(/のレッスン記録を編集/));
    const { router } = jest.requireMock('expo-router');
    expect(router.push).toHaveBeenCalledWith('/lesson-record-form?id=lr-1');
  });

  it('「＋ 追加」を押すと新規フォームへ遷移する', () => {
    renderWithProviders(<LessonScreen />);
    fireEvent.press(screen.getByText('＋ 追加'));
    const { router } = jest.requireMock('expo-router');
    expect(router.push).toHaveBeenCalledWith('/lesson-record-form');
  });
});
