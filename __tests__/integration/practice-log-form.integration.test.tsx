import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import PracticeLogFormScreen from '@/app/practice-log-form';
import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput, today } from '@/forms/practice-log';
import { type PracticeSession, usePracticeLogStore } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useFocusEffect: () => {},
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn().mockResolvedValue('file:///recordings/tmp.m4a'),
  getRecordingUri: jest.fn().mockReturnValue(null),
  createSound: jest.fn().mockResolvedValue(undefined),
  loadRecordedIds: jest.fn().mockResolvedValue(new Set()),
}));

// Select は Portal を使うため jest 環境では PortalProvider が不足してエラーになる。
// テスト対象は RHF の Controller 配線であり Select の UI 自体ではないため、
// onValueChange を直接受け取れるシンプルなコンポーネントに差し替える。
// Select.Trigger に onValueChange を転送することで
// fireEvent(el, 'onValueChange', value) で Controller の onChange を呼び出せる。
jest.mock('tamagui', () => {
  const actual = jest.requireActual('tamagui');
  // jest.mock factory 内では require でモジュールを取得する
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const MockSelectContext = React.createContext(null);

  function MockSelectTrigger(props: any) {
    const ctx = React.useContext(MockSelectContext);
    return React.createElement(
      RN.View,
      { accessibilityLabel: props['aria-label'], onValueChange: ctx?.onValueChange },
      props.children,
    );
  }

  function MockSelect(props: any) {
    return React.createElement(
      MockSelectContext.Provider,
      { value: { onValueChange: props.onValueChange } },
      React.createElement(RN.View, null, props.children),
    );
  }

  function MockSelectValue() {
    return null;
  }
  function MockSelectContent() {
    return null;
  }
  function MockSelectScrollUpButton() {
    return null;
  }
  function MockSelectViewport() {
    return null;
  }
  function MockSelectItem() {
    return null;
  }
  function MockSelectItemText() {
    return null;
  }
  function MockSelectScrollDownButton() {
    return null;
  }

  MockSelect.Trigger = MockSelectTrigger;
  MockSelect.Value = MockSelectValue;
  MockSelect.Content = MockSelectContent;
  MockSelect.ScrollUpButton = MockSelectScrollUpButton;
  MockSelect.Viewport = MockSelectViewport;
  MockSelect.Item = MockSelectItem;
  MockSelect.ItemText = MockSelectItemText;
  MockSelect.ScrollDownButton = MockSelectScrollDownButton;

  return { ...actual, Select: MockSelect };
});

const TB1_ID = '123e4567-e89b-12d3-a456-426614174001';
const SCALE_TB_ID = '123e4567-e89b-12d3-a456-426614174003';

describe('PracticeLogForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePracticeLogStore.setState({ sessions: [], loading: false });
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: TB1_ID,
          title: 'ローズ 32のエチュード',
          publisher: null,
          genre: 'エチュード',
          difficulty: null,
          totalPages: 32,
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'アルテ教則本 第1巻',
          publisher: null,
          genre: 'その他',
          difficulty: null,
          totalPages: 120,
        },
        {
          id: SCALE_TB_ID,
          title: 'スケール練習',
          publisher: null,
          genre: 'スケール',
          difficulty: null,
          totalPages: null,
        },
      ],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('practicedAt を空にして保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('日付'), '');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('日付を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ロングトーンに 0 を入力して保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '0');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('タンギングに 0 を入力して保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '0');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('教本エントリの追加・削除が動作する', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    expect(screen.getByLabelText('エントリ 1 を削除')).toBeTruthy();
    expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('エントリ 1 を削除'));
    await waitFor(() => {
      expect(screen.queryByLabelText('エントリ 1 を削除')).toBeNull();
      expect(screen.queryByLabelText('教本を選択 1')).toBeNull();
    });
  });

  it('基礎練習と教本エントリを入力して保存すると onSubmit に正しい値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '15');
    fireEvent.changeText(screen.getByLabelText('タンギング'), '10');

    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
    const trigger = screen.getByLabelText('教本を選択 1');
    await act(async () => {
      await trigger.props.onValueChange?.(TB1_ID);
    });
    fireEvent.changeText(screen.getByLabelText('ページ 1'), '14');

    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      longToneMinutes: 15,
      tonguingMinutes: 10,
      textbookEntries: [{ textbookId: TB1_ID, currentPage: 14 }],
    });
  });

  it('タンギングに値を入力すると「テンポを追加」ボタンが表示される', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    expect(screen.queryByLabelText('テンポを追加')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
    await waitFor(() => {
      expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
    });
  });

  it('タンギングの値を消すと「テンポを追加」ボタンが非表示になる', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
    await waitFor(() => {
      expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByLabelText('タンギング'), '');
    await waitFor(() => {
      expect(screen.queryByLabelText('テンポを追加')).toBeNull();
    });
  });

  it('「テンポを追加」を押すと BPM 入力欄が追加される', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
    await waitFor(() => {
      expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('テンポを追加'));
    expect(screen.getByLabelText('BPM 1')).toBeTruthy();
    expect(screen.getByLabelText('BPM 1 を削除')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('テンポを追加'));
    expect(screen.getByLabelText('BPM 2')).toBeTruthy();
  });

  it('BPM 入力欄を削除できる', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
    await waitFor(() => {
      expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('テンポを追加'));
    expect(screen.getByLabelText('BPM 1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('BPM 1 を削除'));
    await waitFor(() => {
      expect(screen.queryByLabelText('BPM 1')).toBeNull();
    });
  });

  it('BPM に 39 を入力して保存するとバリデーションエラーが表示される', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
    await waitFor(() => {
      expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('テンポを追加'));
    fireEvent.changeText(screen.getByLabelText('BPM 1'), '39');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('40以上の整数を入力してください')).toBeTruthy();
    });
  });

  it('BPM を複数入力して保存すると onSubmit に tonguingTempoBpms が含まれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
    await waitFor(() => {
      expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('テンポを追加'));
    fireEvent.press(screen.getByLabelText('テンポを追加'));
    fireEvent.changeText(screen.getByLabelText('BPM 1'), '80');
    fireEvent.changeText(screen.getByLabelText('BPM 2'), '120');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      tonguingMinutes: 15,
      tonguingTempoBpms: [{ bpm: 80 }, { bpm: 120 }],
    });
  });

  it('メモ入力欄は日付入力の直後に表示される', () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    const memo = screen.getByLabelText('メモ');
    const date = screen.getByLabelText('日付');
    expect(memo).toBeTruthy();
    expect(date).toBeTruthy();
  });

  it('その他に値を入力して保存すると onSubmit に otherMinutes が含まれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('その他'), '20');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ otherMinutes: 20 });
  });

  it('その他に 0 を入力して保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('その他'), '0');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getAllByText('1以上の整数を入力してください').length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('スケール教本を選択するとテンポ追加ボタンが表示される', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
    expect(screen.queryByLabelText('スケールテンポを追加 1')).toBeNull();

    const trigger = screen.getByLabelText('教本を選択 1');
    await act(async () => {
      await trigger.props.onValueChange?.(SCALE_TB_ID);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('スケールテンポを追加 1')).toBeTruthy();
    });
  });

  it('スケール教本のテンポを複数追加して保存すると tempoBpms に値が含まれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
    const trigger = screen.getByLabelText('教本を選択 1');
    await act(async () => {
      await trigger.props.onValueChange?.(SCALE_TB_ID);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('スケールテンポを追加 1')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('スケールテンポを追加 1'));
    fireEvent.press(screen.getByLabelText('スケールテンポを追加 1'));
    fireEvent.changeText(screen.getByLabelText('スケールBPM 1-1'), '80');
    fireEvent.changeText(screen.getByLabelText('スケールBPM 1-2'), '100');
    fireEvent.changeText(screen.getByLabelText('ページ 1'), '5');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].textbookEntries[0].tempoBpms).toEqual([
      { bpm: 80 },
      { bpm: 100 },
    ]);
  });

  it('スケール以外の教本にはテンポ追加ボタンが表示されない', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
    const trigger = screen.getByLabelText('教本を選択 1');
    await act(async () => {
      await trigger.props.onValueChange?.(TB1_ID);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('ページ 1')).toBeTruthy();
    });
    expect(screen.queryByLabelText('スケールテンポを追加 1')).toBeNull();
  });

  describe('教本デフォルト値', () => {
    it('前回セッションの教本が初期値として表示される', async () => {
      usePracticeLogStore.setState({
        sessions: [
          {
            id: 'prev-session',
            practicedAt: '2026-05-14',
            durationMinutes: 20,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            textbookEntries: [
              {
                textbookId: TB1_ID,
                textbookTitle: 'ローズ 32のエチュード',
                currentPage: 14,
                totalPages: 32,
                genre: 'エチュード',
                durationMinutes: null,
                tempoBpm: null,
              },
            ],
            basicMenuEntries: [],
          },
        ],
        loading: false,
      });

      renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText('ページ 1')).toBeTruthy();
      });
      expect(screen.getByDisplayValue('14')).toBeTruthy();
    });

    it('カタログに存在しない教本は除外される', async () => {
      usePracticeLogStore.setState({
        sessions: [
          {
            id: 'prev-session',
            practicedAt: '2026-05-14',
            durationMinutes: 20,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            textbookEntries: [
              {
                textbookId: 'deleted-textbook-id-that-is-not-a-valid-uuid',
                textbookTitle: '削除済み教本',
                currentPage: 5,
                totalPages: null,
                genre: 'その他',
                durationMinutes: null,
                tempoBpm: null,
              },
            ],
            basicMenuEntries: [],
          },
        ],
        loading: false,
      });

      renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.queryByLabelText('ページ 1')).toBeNull();
      });
    });

    it('前回セッションがない場合は教本エントリが空', () => {
      usePracticeLogStore.setState({ sessions: [], loading: false });

      renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

      expect(screen.queryByLabelText('ページ 1')).toBeNull();
    });
  });
});

describe('その他練習内容', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    AsyncStorage.clear();
  });

  it('その他練習内容を入力して送信すると otherMemo が渡る', async () => {
    const handleSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={handleSubmit} />);

    fireEvent.changeText(screen.getByLabelText('日付'), '2026-05-17');
    fireEvent.changeText(screen.getByLabelText('その他練習内容'), '曲の通し練習');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ otherMemo: '曲の通し練習' }),
      );
    });
  });
});

describe('フォームサマリー 合計表示', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    AsyncStorage.clear();
  });

  it('longToneMinutes と otherMinutes を入力すると合計が表示される', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '20');
    fireEvent.changeText(screen.getByLabelText('その他'), '10');

    await waitFor(() => {
      expect(screen.getByText('合計: 30分')).toBeTruthy();
    });
  });
});

describe('PracticeLogForm with initialValues (編集モード)', () => {
  const initialValues: PracticeLogInput = {
    practicedAt: '2026-01-15',
    longToneMinutes: 20,
    tonguingMinutes: 10,
    tonguingTempoBpms: [{ bpm: 100 }],
    otherMinutes: 15,
    memo: 'テストメモ',
    textbookEntries: [],
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    usePracticeLogStore.setState({ sessions: [], loading: false });
    useTextbookCatalogStore.setState({ textbooks: [], loading: false });
    jest.clearAllMocks();
  });

  it('initialValues でフィールドが初期化される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} initialValues={initialValues} />);

    expect(screen.getByDisplayValue('2026-01-15')).toBeTruthy();
    expect(screen.getByDisplayValue('20')).toBeTruthy();
    expect(screen.getByDisplayValue('10')).toBeTruthy();
    expect(screen.getByDisplayValue('テストメモ')).toBeTruthy();
    expect(screen.getByDisplayValue('15')).toBeTruthy(); // otherMinutes
  });

  it('initialValues を保存すると onSubmit が呼ばれる', async () => {
    const onSubmit = jest.fn();
    const ref = React.createRef<PracticeLogFormRef>();
    renderWithProviders(
      <PracticeLogForm ref={ref} onSubmit={onSubmit} initialValues={initialValues} />,
    );

    await act(async () => {
      ref.current?.submit();
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          practicedAt: '2026-01-15',
          longToneMinutes: 20,
          tonguingMinutes: 10,
          memo: 'テストメモ',
        }),
      );
    });
  });

  it('initialValues を後から差し替えると reset() でフィールドが置き換わる', async () => {
    const { rerender } = renderWithProviders(
      <PracticeLogForm onSubmit={jest.fn()} initialValues={initialValues} />,
    );

    expect(screen.getByDisplayValue('テストメモ')).toBeTruthy();

    const swapped: PracticeLogInput = {
      ...initialValues,
      practicedAt: '2026-03-10',
      memo: '差し替え後のメモ',
      otherMinutes: 5,
    };
    rerender(<PracticeLogForm onSubmit={jest.fn()} initialValues={swapped} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('差し替え後のメモ')).toBeTruthy();
      expect(screen.getByDisplayValue('2026-03-10')).toBeTruthy();
    });
  });

  it('日付欄を変更すると onPracticedAtChange に新しい日付が通知される', async () => {
    const onPracticedAtChange = jest.fn();
    renderWithProviders(
      <PracticeLogForm onSubmit={jest.fn()} onPracticedAtChange={onPracticedAtChange} />,
    );

    fireEvent.changeText(screen.getByLabelText('日付'), '2026-05-20');

    await waitFor(() => {
      expect(onPracticedAtChange).toHaveBeenCalledWith('2026-05-20');
    });
  });
});

function makeSession(overrides: Partial<PracticeSession>): PracticeSession {
  return {
    id: 'session-id',
    practicedAt: '2026-05-15',
    durationMinutes: null,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: null,
    memo: null,
    textbookEntries: [],
    basicMenuEntries: [],
    ...overrides,
  };
}

describe('PracticeLogFormScreen (同日 1 件: 自動切替 / 衝突時 Alert)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePracticeLogStore.setState({ sessions: [], loading: false });
    useTextbookCatalogStore.setState({ textbooks: [], loading: false });
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    (router.back as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  it('mount 時に today へ既存記録があれば編集モードへ自動切替され既存値が反映される', async () => {
    const todayStr = today();
    usePracticeLogStore.setState({
      sessions: [
        makeSession({
          id: 'today-session',
          practicedAt: todayStr,
          memo: '今日の既存メモ',
          basicMenuEntries: [{ menuType: 'long_tone', durationMinutes: 20, tempoBpms: [] }],
        }),
      ],
    });

    renderWithProviders(<PracticeLogFormScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('今日の既存メモ')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('20')).toBeTruthy();
    expect(screen.getByLabelText('練習記録を削除')).toBeTruthy();
  });

  it('日付欄を空き日付 → 既存日付に変えると編集モードへ切替わる', async () => {
    usePracticeLogStore.setState({
      sessions: [
        makeSession({
          id: 'may-15',
          practicedAt: '2026-05-15',
          memo: '5/15 の既存メモ',
        }),
      ],
    });

    renderWithProviders(<PracticeLogFormScreen />);

    // 初期は新規モード (today に既存なしの想定)
    expect(screen.queryByLabelText('練習記録を削除')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('日付'), '2026-05-15');

    await waitFor(() => {
      expect(screen.getByDisplayValue('5/15 の既存メモ')).toBeTruthy();
    });
    expect(screen.getByLabelText('練習記録を削除')).toBeTruthy();
  });

  it('保存時に add が duplicate を返したら Alert が出て router.back は呼ばれない', async () => {
    const addMock = jest.fn().mockResolvedValue({ ok: false, reason: 'duplicate' });
    usePracticeLogStore.setState({ sessions: [], add: addMock });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    renderWithProviders(<PracticeLogFormScreen />);
    fireEvent.changeText(screen.getByLabelText('日付'), '2026-05-20');
    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '15');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('保存できません', expect.stringContaining('同じ日付'));
    });
    expect(router.back).not.toHaveBeenCalled();
    expect(addMock).toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
