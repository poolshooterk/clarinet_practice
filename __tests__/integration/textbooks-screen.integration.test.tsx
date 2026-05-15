import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';

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

describe('TextbooksScreen 教本管理 (integration)', () => {
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

  it('カードをタップすると編集フォームへ遷移する', () => {
    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ローズ 32のエチュードを編集'));
    const { router } = jest.requireMock('expo-router');
    expect(router.push).toHaveBeenCalledWith('/textbook-form?id=tb-1');
  });
});
