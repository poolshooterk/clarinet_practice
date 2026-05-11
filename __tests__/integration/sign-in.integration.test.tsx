import { fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SignIn from '@/app/(auth)/sign-in';
import { supabase } from '@/lib/supabase';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
}));

describe('サインイン画面 (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('空送信でフォームエラーが表示される', async () => {
    renderWithProviders(<SignIn />);
    fireEvent.press(screen.getByText('サインイン'));

    await waitFor(() => {
      expect(screen.getByText('メールアドレスの形式が正しくありません')).toBeOnTheScreen();
    });
    expect(screen.getByText('パスワードを入力してください')).toBeOnTheScreen();
  });

  it('有効な入力で signInWithPassword が呼ばれる', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: {},
      error: null,
    });

    renderWithProviders(<SignIn />);
    fireEvent.changeText(screen.getByPlaceholderText('メールアドレス'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('パスワード'), 'password123');
    fireEvent.press(screen.getByText('サインイン'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('Supabase エラー時に Alert が表示される', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    renderWithProviders(<SignIn />);
    fireEvent.changeText(screen.getByPlaceholderText('メールアドレス'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('パスワード'), 'wrongpass');
    fireEvent.press(screen.getByText('サインイン'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'エラー',
        'メールアドレスまたはパスワードが正しくありません',
      );
    });
  });
});
