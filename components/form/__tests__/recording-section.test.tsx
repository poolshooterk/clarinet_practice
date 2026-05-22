import { fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { RecordingSection } from '@/components/form/recording-section';
import type { SessionRecording } from '@/store/practice-log';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn().mockResolvedValue({}),
  stopRecording: jest.fn().mockResolvedValue('file:///recordings/tmp-1234.m4a'),
  pauseRecording: jest.fn().mockResolvedValue(undefined),
  resumeRecording: jest.fn().mockResolvedValue(undefined),
  createSound: jest.fn(),
}));

const NO_RECORDINGS: SessionRecording[] = [];

describe('RecordingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('web では何もレンダリングされない', () => {
    const originalOS = Platform.OS;
    (Platform as { OS: string }).OS = 'web';
    const { toJSON } = renderWithProviders(
      <RecordingSection existingRecordings={NO_RECORDINGS} onChange={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
    (Platform as { OS: string }).OS = originalOS;
  });

  it('idle 状態: 録音追加ボタンが表示される', () => {
    renderWithProviders(
      <RecordingSection existingRecordings={NO_RECORDINGS} onChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('録音を追加')).toBeTruthy();
  });

  it('録音開始後に REC 表示と停止ボタンが出る', async () => {
    renderWithProviders(
      <RecordingSection existingRecordings={NO_RECORDINGS} onChange={jest.fn()} />,
    );
    fireEvent.press(screen.getByLabelText('録音を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('録音を停止')).toBeTruthy();
    });
    expect(screen.getByText(/REC/)).toBeTruthy();
  });

  it('停止後に onChange が { toAdd: [{ tempUri, memo }], toDelete: [] } で呼ばれる', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <RecordingSection existingRecordings={NO_RECORDINGS} onChange={onChange} />,
    );

    fireEvent.press(screen.getByLabelText('録音を追加'));
    await waitFor(() => expect(screen.getByLabelText('録音を停止')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('録音を停止'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        toAdd: [{ tempUri: 'file:///recordings/tmp-1234.m4a', memo: '' }],
        toDelete: [],
      });
    });
  });

  it('一時停止ボタンを押すと PAUSE 表示になる', async () => {
    renderWithProviders(
      <RecordingSection existingRecordings={NO_RECORDINGS} onChange={jest.fn()} />,
    );

    fireEvent.press(screen.getByLabelText('録音を追加'));
    await waitFor(() => expect(screen.getByLabelText('一時停止')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('一時停止'));
    await waitFor(() => {
      expect(screen.getByText(/PAUSE/)).toBeTruthy();
    });
    expect(screen.getByLabelText('録音を再開')).toBeTruthy();
  });

  it('既存録音が渡されると録音カードが表示される', () => {
    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
    ];
    renderWithProviders(<RecordingSection existingRecordings={existing} onChange={jest.fn()} />);
    expect(screen.getByLabelText('録音 1を削除')).toBeTruthy();
  });

  it('既存録音の削除ボタンを押すと onChange が toDelete に id を含めて呼ばれる', () => {
    const onChange = jest.fn();
    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
    ];
    renderWithProviders(<RecordingSection existingRecordings={existing} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('録音 1を削除'));
    expect(onChange).toHaveBeenCalledWith({ toAdd: [], toDelete: ['rec-1'] });
  });

  it('録音が 3 本になると追加ボタンが消える', async () => {
    const onChange = jest.fn();
    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
      { id: 'rec-2', index: 2, localUri: 'file:///recordings/s-2.m4a', memo: null },
      { id: 'rec-3', index: 3, localUri: 'file:///recordings/s-3.m4a', memo: null },
    ];
    renderWithProviders(<RecordingSection existingRecordings={existing} onChange={onChange} />);
    expect(screen.queryByLabelText('録音を追加')).toBeNull();
  });
});
