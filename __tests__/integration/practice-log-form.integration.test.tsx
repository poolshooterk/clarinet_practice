import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { PracticeLogForm } from '@/components/practice-log-form';
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
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: TB1_ID,
          title: 'ローズ 32のエチュード',
          publisher: null,
          difficulty: null,
          totalPages: 32,
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'アルテ教則本 第1巻',
          publisher: null,
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
});
