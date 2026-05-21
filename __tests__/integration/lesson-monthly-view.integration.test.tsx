import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

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
  finalizeRecording: jest.fn(),
  deleteRecording: jest.fn(),
  createSound: jest.fn(),
}));

jest.mock('@/forms/lesson-record', () => ({
  ...jest.requireActual('@/forms/lesson-record'),
  today: () => '2026-05-22',
}));

const RECORDS = [
  {
    id: 'lr-may1',
    heldAt: '2026-05-04T05:00:00.000Z',
    advice: 'アドバイスA',
    notes: null,
    textbookEntries: [
      {
        textbookId: 'tb-1',
        textbookTitle: 'ローゼンタール',
        currentPage: 45,
        durationMinutes: null,
        tempoBpm: null,
      },
    ],
    recordings: [],
  },
  {
    id: 'lr-may2',
    heldAt: '2026-05-18T05:00:00.000Z',
    advice: 'アドバイスB',
    notes: null,
    textbookEntries: [
      {
        textbookId: 'tb-1',
        textbookTitle: 'ローゼンタール',
        currentPage: 62,
        durationMinutes: null,
        tempoBpm: null,
      },
    ],
    recordings: [],
  },
  {
    id: 'lr-apr1',
    heldAt: '2026-04-10T05:00:00.000Z',
    advice: 'アドバイスC',
    notes: null,
    textbookEntries: [],
    recordings: [],
  },
];

describe('LessonScreen 月別ビュー (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({ records: RECORDS, loading: false });
    jest.clearAllMocks();
  });

  it('現在月 (2026-05) のレコードのみ表示され、4月のレコードは表示されない', () => {
    renderWithProviders(<LessonScreen />);
    expect(screen.queryByText(/アドバイスA/)).not.toBeNull();
    expect(screen.queryByText(/アドバイスB/)).not.toBeNull();
    expect(screen.queryByText(/アドバイスC/)).toBeNull();
  });

  it('月間サマリーにレッスン回数が表示される', () => {
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText(/今月のレッスン: 2回/)).toBeTruthy();
  });

  it('月間教本進捗の差分が表示される（ローゼンタール +17）', () => {
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText(/ローゼンタール.*\+17/)).toBeTruthy();
  });

  it('前月ボタンで 2026-04 に切り替えると4月のレコードが表示される', async () => {
    renderWithProviders(<LessonScreen />);
    fireEvent.press(screen.getByLabelText('前月へ'));
    await waitFor(() => {
      expect(screen.queryByText(/アドバイスC/)).not.toBeNull();
    });
    expect(screen.queryByText(/アドバイスA/)).toBeNull();
  });

  it('recordings.length > 0 のレコードには ♪ バッジが表示される', () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-with-rec',
          heldAt: '2026-05-01T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
          recordings: [
            {
              id: 'rec-1',
              index: 1 as const,
              localUri: 'file:///data/recordings/lr-with-rec-1.m4a',
              memo: null,
            },
          ],
        },
      ],
      loading: false,
    });
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText('♪')).toBeTruthy();
  });
});
