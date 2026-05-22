import * as FileSystem from 'expo-file-system/legacy';

import {
  createSound,
  deleteRecording,
  finalizeRecording,
  getRecordingUri,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
} from '@/lib/recording';

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: {
      createAsync: jest.fn(),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn(),
}));

const mockAudio = () => jest.requireMock('expo-av').Audio;
const mockFS = () => jest.requireMock('expo-file-system/legacy') as jest.Mocked<typeof FileSystem>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startRecording', () => {
  it('マイク権限を要求し録音オブジェクトを返す', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as unknown as FileSystem.FileInfo);
    const mockRecording = { stopAndUnloadAsync: jest.fn(), getURI: jest.fn() };
    mockAudio().Recording.createAsync.mockResolvedValueOnce({ recording: mockRecording });

    const recording = await startRecording();

    expect(mockAudio().requestPermissionsAsync).toHaveBeenCalled();
    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    expect(recording).toBe(mockRecording);
  });

  it('recordings/ ディレクトリが存在しない場合は作成する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({
      exists: false,
    } as unknown as FileSystem.FileInfo);
    mockAudio().Recording.createAsync.mockResolvedValueOnce({ recording: {} });

    await startRecording();

    expect(mockFS().makeDirectoryAsync).toHaveBeenCalledWith('file:///data/recordings/', {
      intermediates: true,
    });
  });
});

describe('stopRecording', () => {
  it('録音を停止し tmp-{timestamp}.m4a に移動して URI を返す', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///tmp/some.caf'),
    };

    const uri = await stopRecording(mockRecording as never);

    expect(mockFS().moveAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/some.caf',
      to: 'file:///data/recordings/tmp-1234567890.m4a',
    });
    expect(uri).toBe('file:///data/recordings/tmp-1234567890.m4a');
  });

  it('URI が null のとき例外を投げる', async () => {
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue(null),
    };

    await expect(stopRecording(mockRecording as never)).rejects.toThrow(
      '録音ファイルURIが取得できませんでした',
    );
  });

  it('getURI は stopAndUnloadAsync より前に呼ばれる', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(9999);
    const callOrder: string[] = [];
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockImplementation(async () => {
        callOrder.push('stopAndUnloadAsync');
      }),
      getURI: jest.fn().mockImplementation(() => {
        callOrder.push('getURI');
        return 'file:///tmp/some.caf';
      }),
    };

    await stopRecording(mockRecording as never);

    expect(callOrder.indexOf('getURI')).toBeLessThan(callOrder.indexOf('stopAndUnloadAsync'));
  });
});

describe('pauseRecording', () => {
  it('recording.pauseAsync を呼ぶ', async () => {
    const mockRecording = { pauseAsync: jest.fn().mockResolvedValue(undefined) };
    await pauseRecording(mockRecording as never);
    expect(mockRecording.pauseAsync).toHaveBeenCalled();
  });
});

describe('resumeRecording', () => {
  it('recording.startAsync を呼ぶ（expo-av は startAsync で一時停止を再開する）', async () => {
    const mockRecording = { startAsync: jest.fn().mockResolvedValue(undefined) };
    await resumeRecording(mockRecording as never);
    expect(mockRecording.startAsync).toHaveBeenCalled();
  });
});

describe('finalizeRecording', () => {
  it('tempUri を {sessionId}-{index}.m4a にリネームし dest URI を返す', async () => {
    const destUri = await finalizeRecording(
      'file:///data/recordings/tmp-1234.m4a',
      'session-abc',
      2,
    );

    expect(mockFS().moveAsync).toHaveBeenCalledWith({
      from: 'file:///data/recordings/tmp-1234.m4a',
      to: 'file:///data/recordings/session-abc-2.m4a',
    });
    expect(destUri).toBe('file:///data/recordings/session-abc-2.m4a');
  });
});

describe('deleteRecording', () => {
  it('ファイルが存在する場合は削除する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as unknown as FileSystem.FileInfo);

    await deleteRecording('file:///data/recordings/session-abc-1.m4a');

    expect(mockFS().deleteAsync).toHaveBeenCalledWith('file:///data/recordings/session-abc-1.m4a');
  });

  it('ファイルが存在しない場合はスキップする', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({
      exists: false,
    } as unknown as FileSystem.FileInfo);

    await deleteRecording('file:///data/recordings/session-abc-1.m4a');

    expect(mockFS().deleteAsync).not.toHaveBeenCalled();
  });
});

describe('getRecordingUri', () => {
  it('ファイルパスを返す（存在確認なし）', () => {
    expect(getRecordingUri('session-abc', 1)).toBe('file:///data/recordings/session-abc-1.m4a');
    expect(getRecordingUri('session-abc', 3)).toBe('file:///data/recordings/session-abc-3.m4a');
  });
});

describe('createSound', () => {
  it('Sound オブジェクトを返す', async () => {
    const mockSound = { playAsync: jest.fn() };
    mockAudio().Sound.createAsync.mockResolvedValueOnce({ sound: mockSound });

    const sound = await createSound('file:///data/recordings/session-abc-1.m4a');

    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    expect(sound).toBe(mockSound);
  });
});
