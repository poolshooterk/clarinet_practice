import { fireEvent, waitFor } from '@testing-library/react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  createSound: jest.fn(),
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: jest.fn((selector) =>
    selector({
      textbooks: [
        { id: 'tb-1', title: 'ローズ 32のエチュード', genre: 'エチュード', totalPages: 32 },
      ],
    }),
  ),
}));

const defaultValues = {
  date: '2026-05-15',
  time: '14:00',
  advice: '',
  notes: '',
  textbookEntries: [],
};

describe('LessonRecordForm (integration)', () => {
  it('日付が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm onSubmit={onSubmit} defaultValues={{ ...defaultValues, date: '' }} />,
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
      <LessonRecordForm onSubmit={onSubmit} defaultValues={{ ...defaultValues, time: '' }} />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('時刻を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('日付・時刻を入力して保存すると onSubmit が呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<LessonRecordForm onSubmit={onSubmit} defaultValues={defaultValues} />);
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [],
    });
    expect(onSubmit.mock.calls[0][1]).toEqual({ toAdd: [], toDelete: [] });
  });

  it('アドバイスと気づきを入力して保存すると onSubmit に値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<LessonRecordForm onSubmit={onSubmit} defaultValues={defaultValues} />);
    fireEvent.changeText(screen.getByLabelText('アドバイス'), 'タンギングを軽く');
    fireEvent.changeText(screen.getByLabelText('気づいたこと'), '息が足りない');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      advice: 'タンギングを軽く',
      notes: '息が足りない',
    });
  });

  it('フィールドを編集すると onDirtyChange が true で呼ばれる', async () => {
    const onDirtyChange = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={jest.fn()}
        defaultValues={defaultValues}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.changeText(screen.getByLabelText('アドバイス'), 'タンギングを軽く');
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });
  });

  it('教本を追加ボタンを押すとエントリが1件増える', async () => {
    renderWithProviders(<LessonRecordForm onSubmit={jest.fn()} defaultValues={defaultValues} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
  });
});
