import { fireEvent, waitFor } from '@testing-library/react-native';

import { ProfileForm } from '@/components/profile-form';
import { renderWithProviders, screen } from '@/test-utils/render';

describe('ProfileForm (integration)', () => {
  it('initial render shows all input fields with empty values', () => {
    renderWithProviders(<ProfileForm />);

    expect(screen.getByPlaceholderText('名前')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('メールアドレス')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('年齢 (任意)')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('YYYY-MM-DD')).toBeOnTheScreen();
    expect(screen.getByText('送信')).toBeOnTheScreen();
    expect(screen.getByText('リセット')).toBeOnTheScreen();
  });

  it('submitting an empty form surfaces zod errors via FieldError', async () => {
    renderWithProviders(<ProfileForm />);

    fireEvent.press(screen.getByText('送信'));

    await waitFor(() => {
      expect(screen.getByText('名前を入力してください')).toBeOnTheScreen();
    });
    expect(screen.getByText('メールアドレスの形式が正しくありません')).toBeOnTheScreen();
    expect(screen.getByText('生年月日を入力してください')).toBeOnTheScreen();
    expect(screen.getByText('利用規約への同意が必要です')).toBeOnTheScreen();
  });

  it('shows email error on blur with invalid value (onTouched mode)', async () => {
    renderWithProviders(<ProfileForm />);
    const email = screen.getByPlaceholderText('メールアドレス');

    fireEvent.changeText(email, 'not-an-email');
    fireEvent(email, 'blur');

    await waitFor(() => {
      expect(screen.getByText('メールアドレスの形式が正しくありません')).toBeOnTheScreen();
    });
  });

  it('clears email error after the input becomes valid', async () => {
    renderWithProviders(<ProfileForm />);
    const email = screen.getByPlaceholderText('メールアドレス');

    fireEvent.changeText(email, 'bad');
    fireEvent(email, 'blur');
    await waitFor(() =>
      expect(screen.getByText('メールアドレスの形式が正しくありません')).toBeOnTheScreen(),
    );

    fireEvent.changeText(email, 'taro@example.com');
    fireEvent(email, 'blur');

    await waitFor(
      () => expect(screen.queryByText('メールアドレスの形式が正しくありません')).toBeNull(),
      { timeout: 3000 },
    );
  });

  it('submits with valid input and invokes onSubmit prop', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText('名前'), '太郎');
    fireEvent.changeText(screen.getByPlaceholderText('メールアドレス'), 'taro@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2000-01-15');
    fireEvent.press(screen.getByLabelText('利用規約に同意'));

    fireEvent.press(screen.getByText('送信'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: '太郎',
        email: 'taro@example.com',
        birthday: '2000-01-15',
        agreed: true,
        score: 50,
      }),
    );
  });

  it('does not invoke onSubmit when validation fails', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('送信'));

    await waitFor(() => expect(screen.getByText('名前を入力してください')).toBeOnTheScreen());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reset button clears the entered values', async () => {
    renderWithProviders(<ProfileForm />);
    const name = screen.getByPlaceholderText('名前');

    fireEvent.changeText(name, '太郎');
    expect(name.props.value).toBe('太郎');

    fireEvent.press(screen.getByText('リセット'));

    await waitFor(() => {
      expect(name.props.value).toBe('');
    });
  });
});
