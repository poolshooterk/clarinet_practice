import * as FileSystem from 'expo-file-system/legacy';

import {
  createSound,
  deleteRecording,
  finalizeRecording,
  getRecordingUri,
  loadRecordedIds,
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
    const mockRecording = {};
    mockAudio().Recording.createAsync.mockResolvedValueOnce({ recording: mockRecording });

    await startRecording();

    expect(mockFS().makeDirectoryAsync).toHaveBeenCalledWith('file:///data/recordings/', {
      intermediates: true,
    });
  });
});

describe('stopRecording', () => {
  it('録音を停止し tmp.m4a に移動して URI を返す', async () => {
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///tmp/some.caf'),
    };

    const uri = await stopRecording(mockRecording as never);

    expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({ allowsRecordingIOS: false });
    expect(mockFS().moveAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/some.caf',
      to: 'file:///data/recordings/tmp.m4a',
    });
    expect(uri).toBe('file:///data/recordings/tmp.m4a');
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
});

describe('finalizeRecording', () => {
  it('tmp.m4a を {sessionId}.m4a にリネームする', async () => {
    await finalizeRecording('session-abc');

    expect(mockFS().moveAsync).toHaveBeenCalledWith({
      from: 'file:///data/recordings/tmp.m4a',
      to: 'file:///data/recordings/session-abc.m4a',
    });
  });
});

describe('deleteRecording', () => {
  it('ファイルが存在する場合は削除する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as unknown as FileSystem.FileInfo);

    await deleteRecording('session-abc');

    expect(mockFS().deleteAsync).toHaveBeenCalledWith('file:///data/recordings/session-abc.m4a');
  });

  it('ファイルが存在しない場合はスキップする', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({
      exists: false,
    } as unknown as FileSystem.FileInfo);

    await deleteRecording('session-abc');

    expect(mockFS().deleteAsync).not.toHaveBeenCalled();
  });
});

describe('getRecordingUri', () => {
  it('ファイルパスを返す（存在確認なし）', () => {
    expect(getRecordingUri('session-abc')).toBe('file:///data/recordings/session-abc.m4a');
  });
});

describe('loadRecordedIds', () => {
  it('ディレクトリが存在しない場合は空の Set を返す', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({
      exists: false,
    } as unknown as FileSystem.FileInfo);

    const ids = await loadRecordedIds();

    expect(ids.size).toBe(0);
  });

  it('.m4a ファイルから sessionId を抽出し tmp と非 m4a は除外する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as unknown as FileSystem.FileInfo);
    mockFS().readDirectoryAsync.mockResolvedValueOnce([
      'session-abc.m4a',
      'session-def.m4a',
      'tmp.m4a',
      'other.txt',
    ]);

    const ids = await loadRecordedIds();

    expect(ids).toEqual(new Set(['session-abc', 'session-def']));
  });
});

describe('createSound', () => {
  it('Sound オブジェクトを返す', async () => {
    const mockSound = { playAsync: jest.fn() };
    mockAudio().Sound.createAsync.mockResolvedValueOnce({ sound: mockSound });

    const sound = await createSound('file:///data/recordings/session-abc.m4a');

    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    expect(mockAudio().Sound.createAsync).toHaveBeenCalledWith({
      uri: 'file:///data/recordings/session-abc.m4a',
    });
    expect(sound).toBe(mockSound);
  });
});
