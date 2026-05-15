import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import TextbooksScreen from '@/app/textbooks';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = () => jest.requireMock('@/lib/supabase').supabase;

describe('TextbooksScreen 進捗管理 (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: 'tb-1',
          title: 'ローズ 32のエチュード',
          publisher: null,
          genre: 'エチュード',
          difficulty: null,
          totalPages: 32,
        },
      ],
      loading: false,
    });
    useTextbookProgressStore.setState({ progress: {} });
    jest.clearAllMocks();
  });

  it('totalPages がある教本に進捗テキストが表示される', () => {
    renderWithProviders(<TextbooksScreen />);
    expect(screen.getByText('0 / 32')).toBeTruthy();
  });

  it('進捗がある教本には現在ページが表示される', () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    renderWithProviders(<TextbooksScreen />);
    expect(screen.getByText('10 / 32')).toBeTruthy();
  });

  it('行をタップするとモーダルが開く', async () => {
    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ローズ 32のエチュードの進捗を更新'));
    await waitFor(() => {
      expect(screen.getByText('/ 32 ページ')).toBeTruthy();
    });
  });

  it('モーダルでページを入力して保存すると upsert が呼ばれる', async () => {
    mockSupabase().auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    mockSupabase().from.mockReturnValue({ upsert: upsertMock });

    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ローズ 32のエチュードの進捗を更新'));

    await waitFor(() => {
      expect(screen.getByLabelText('現在ページ')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('現在ページ'), '15');
    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ textbook_id: 'tb-1', current_page: 15 }),
        { onConflict: 'user_id,textbook_id' },
      );
    });
  });

  it('totalPages が未設定の教本をタップすると Alert が表示される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: 'tb-2',
          title: 'ページなし教本',
          publisher: null,
          genre: 'その他',
          difficulty: null,
          totalPages: null,
        },
      ],
      loading: false,
    });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ページなし教本の進捗を更新'));
    expect(alertSpy).toHaveBeenCalledWith('総ページ数が未設定です', expect.any(String));
  });
});
