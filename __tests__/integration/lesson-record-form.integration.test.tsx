import { fireEvent, waitFor } from '@testing-library/react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  createSound: jest.fn(),
}));

describe('LessonRecordForm (integration)', () => {
  it('日付が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{ date: '', time: '14:00', advice: '', notes: '', textbookEntries: [] }}
      />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('日付を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('時刻が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{ date: '2026-05-15', time: '', advice: '', notes: '', textbookEntries: [] }}
      />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('時刻を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('日付・時刻を入力して保存すると onSubmit が呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{
          date: '2026-05-15',
          time: '14:00',
          advice: '',
          notes: '',
          textbookEntries: [],
        }}
      />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ date: '2026-05-15', time: '14:00' });
    expect(onSubmit.mock.calls[0][1]).toBeNull();
    expect(onSubmit.mock.calls[0][2]).toBe(false);
  });

  it('アドバイスと気づきを入力して保存すると onSubmit に値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{
          date: '2026-05-15',
          time: '14:00',
          advice: '',
          notes: '',
          textbookEntries: [],
        }}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('アドバイス'), 'タンギングを軽く');
    fireEvent.changeText(screen.getByLabelText('気づいたこと'), '息のスピードが足りない');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      advice: 'タンギングを軽く',
      notes: '息のスピードが足りない',
    });
    expect(onSubmit.mock.calls[0][1]).toBeNull();
    expect(onSubmit.mock.calls[0][2]).toBe(false);
  });

  it('defaultValues が渡されるとフォームに初期値が表示される', () => {
    renderWithProviders(
      <LessonRecordForm
        defaultValues={{
          date: '2026-05-15',
          time: '14:00',
          advice: 'アドバイスあり',
          notes: 'メモあり',
          textbookEntries: [],
        }}
      />,
    );
    expect(screen.getByLabelText('日付').props.value).toBe('2026-05-15');
    expect(screen.getByLabelText('時刻').props.value).toBe('14:00');
    expect(screen.getByLabelText('アドバイス').props.value).toBe('アドバイスあり');
    expect(screen.getByLabelText('気づいたこと').props.value).toBe('メモあり');
  });

  it('onDelete が渡されると削除ボタンが表示されタップで呼ばれる', () => {
    const onDelete = jest.fn();
    renderWithProviders(<LessonRecordForm onDelete={onDelete} />);
    expect(screen.getByText('このレッスン記録を削除')).toBeTruthy();
    fireEvent.press(screen.getByText('このレッスン記録を削除'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('onDelete が渡されないと削除ボタンが表示されない', () => {
    renderWithProviders(<LessonRecordForm />);
    expect(screen.queryByText('このレッスン記録を削除')).toBeNull();
  });
});
