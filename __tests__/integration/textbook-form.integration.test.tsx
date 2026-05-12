import { fireEvent, waitFor } from '@testing-library/react-native';

import { TextbookForm } from '@/components/textbook-form';
import { renderWithProviders, screen } from '@/test-utils/render';

describe('TextbookForm (integration)', () => {
  it('教本名が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('教本名を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('教本名と難易度を入力して保存すると onSubmit が正しい値で呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.changeText(screen.getByLabelText('出版社'), '全音楽譜出版社');
    fireEvent.press(screen.getByLabelText('難易度 中級'));
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'ローズ 32のエチュード',
      publisher: '全音楽譜出版社',
      difficulty: '中級',
    });
  });

  it('onDelete が渡されると削除ボタンが表示され、タップで呼ばれる', () => {
    const onDelete = jest.fn();
    renderWithProviders(<TextbookForm onDelete={onDelete} />);
    expect(screen.getByText('この教本を削除')).toBeTruthy();
    fireEvent.press(screen.getByText('この教本を削除'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('onDelete が渡されないと削除ボタンが表示されない', () => {
    renderWithProviders(<TextbookForm />);
    expect(screen.queryByText('この教本を削除')).toBeNull();
  });

  it('defaultValues が渡されるとフォームに初期値が表示される', () => {
    renderWithProviders(
      <TextbookForm
        defaultValues={{ title: 'クローゼ 教則本', publisher: '音楽之友社', difficulty: '上級' }}
      />,
    );
    expect(screen.getByLabelText('教本名').props.value).toBe('クローゼ 教則本');
    expect(screen.getByLabelText('出版社').props.value).toBe('音楽之友社');
  });

  it('totalPages を入力して保存すると onSubmit に数値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.changeText(screen.getByLabelText('総ページ数'), '100');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ totalPages: 100 });
  });

  it('totalPages に 0 を入力するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'テスト教本');
    fireEvent.changeText(screen.getByLabelText('総ページ数'), '0');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaultValues に totalPages が含まれるとフォームに表示される', () => {
    renderWithProviders(<TextbookForm defaultValues={{ title: 'テスト', totalPages: 80 }} />);
    expect(screen.getByLabelText('総ページ数').props.value).toBe('80');
  });
});
