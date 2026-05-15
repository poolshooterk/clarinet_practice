import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { PracticeLogForm } from '@/components/practice-log-form';
import { usePracticeLogStore } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
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

  describe('教本デフォルト値', () => {
    it('前回セッションの教本が初期値として表示される', async () => {
      usePracticeLogStore.setState({
        sessions: [
          {
            id: 'prev-session',
            practicedAt: '2026-05-14',
            durationMinutes: 20,
            memo: null,
            textbookEntries: [
              {
                textbookId: TB1_ID,
                textbookTitle: 'ローズ 32のエチュード',
                currentPage: 14,
                totalPages: 32,
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
            memo: null,
            textbookEntries: [
              {
                textbookId: 'deleted-textbook-id-that-is-not-a-valid-uuid',
                textbookTitle: '削除済み教本',
                currentPage: 5,
                totalPages: null,
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
