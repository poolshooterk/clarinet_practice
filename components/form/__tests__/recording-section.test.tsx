import { act, fireEvent, waitFor } from '@testing-library/react-native';
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

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
}));

const keepAwake = () =>
  jest.requireMock('expo-keep-awake') as {
    activateKeepAwakeAsync: jest.Mock;
    deactivateKeepAwake: jest.Mock;
  };

type SoundMock = {
  playAsync: jest.Mock;
  pauseAsync: jest.Mock;
  setOnPlaybackStatusUpdate: jest.Mock;
  setPositionAsync: jest.Mock;
  unloadAsync: jest.Mock;
};

function makeSoundMock(): SoundMock {
  return {
    playAsync: jest.fn().mockResolvedValue(undefined),
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    setOnPlaybackStatusUpdate: jest.fn(),
    setPositionAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
  };
}

const recordingLib = () =>
  jest.requireMock('@/lib/recording') as {
    createSound: jest.Mock;
  };

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

  it('録音開始で keepAwake を activate、停止で deactivate する', async () => {
    renderWithProviders(
      <RecordingSection existingRecordings={NO_RECORDINGS} onChange={jest.fn()} />,
    );

    fireEvent.press(screen.getByLabelText('録音を追加'));
    await waitFor(() => {
      expect(keepAwake().activateKeepAwakeAsync).toHaveBeenCalledWith('clarinet-recording');
    });

    fireEvent.press(screen.getByLabelText('録音を停止'));
    await waitFor(() => {
      expect(keepAwake().deactivateKeepAwake).toHaveBeenCalledWith('clarinet-recording');
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

  it('録音 1 を再生中に録音 2 を再生すると、録音 1 が pause される', async () => {
    const sound1 = makeSoundMock();
    const sound2 = makeSoundMock();
    recordingLib().createSound.mockImplementation((uri: string) => {
      if (uri === 'file:///recordings/s-1.m4a') return Promise.resolve(sound1);
      if (uri === 'file:///recordings/s-2.m4a') return Promise.resolve(sound2);
      throw new Error(`unexpected uri: ${uri}`);
    });

    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
      { id: 'rec-2', index: 2, localUri: 'file:///recordings/s-2.m4a', memo: null },
    ];
    renderWithProviders(<RecordingSection existingRecordings={existing} onChange={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('録音 1再生'));
    await waitFor(() => expect(sound1.playAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('録音 1一時停止')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('録音 2再生'));
    await waitFor(() => expect(sound2.playAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sound1.pauseAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('録音 1再生')).toBeTruthy());
    expect(screen.getByLabelText('録音 2一時停止')).toBeTruthy();
  });

  it('再生完了 (didJustFinish) でボタンが再生状態に戻る', async () => {
    const sound1 = makeSoundMock();
    recordingLib().createSound.mockResolvedValue(sound1);

    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
    ];
    renderWithProviders(<RecordingSection existingRecordings={existing} onChange={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('録音 1再生'));
    await waitFor(() => expect(sound1.setOnPlaybackStatusUpdate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('録音 1一時停止')).toBeTruthy());

    const statusCallback = sound1.setOnPlaybackStatusUpdate.mock.calls[0][0] as (
      status: Record<string, unknown>,
    ) => void;
    act(() => {
      statusCallback({
        isLoaded: true,
        positionMillis: 1000,
        durationMillis: 1000,
        didJustFinish: true,
      });
    });

    await waitFor(() => expect(screen.getByLabelText('録音 1再生')).toBeTruthy());
  });

  it('onDirtyChange: 初期は false、録音開始で true になる', async () => {
    const onDirtyChange = jest.fn();
    renderWithProviders(
      <RecordingSection
        existingRecordings={NO_RECORDINGS}
        onChange={jest.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.press(screen.getByLabelText('録音を追加'));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it('onDirtyChange: 既存録音を削除すると true になる', () => {
    const onDirtyChange = jest.fn();
    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
    ];
    renderWithProviders(
      <RecordingSection
        existingRecordings={existing}
        onChange={jest.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.press(screen.getByLabelText('録音 1を削除'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('onMoveExisting あり: 既存録音に移動ボタンが出て押すと録音を渡して呼ばれる', () => {
    const onMoveExisting = jest.fn();
    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: 'm' },
    ];
    renderWithProviders(
      <RecordingSection
        existingRecordings={existing}
        onChange={jest.fn()}
        onMoveExisting={onMoveExisting}
      />,
    );
    fireEvent.press(screen.getByLabelText('録音 1を移動'));
    expect(onMoveExisting).toHaveBeenCalledWith(existing[0]);
  });

  it('onMoveExisting なし: 移動ボタンは表示されない', () => {
    const existing: SessionRecording[] = [
      { id: 'rec-1', index: 1, localUri: 'file:///recordings/s-1.m4a', memo: null },
    ];
    renderWithProviders(<RecordingSection existingRecordings={existing} onChange={jest.fn()} />);
    expect(screen.queryByLabelText('録音 1を移動')).toBeNull();
  });
});
