import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { shareRecordingFile, shareTextFile } from '@/lib/export';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const sharing = Sharing as jest.Mocked<typeof Sharing>;

beforeEach(() => {
  jest.clearAllMocks();
  fs.getInfoAsync.mockResolvedValue({ exists: false } as FileSystem.FileInfo);
  sharing.isAvailableAsync.mockResolvedValue(true);
});

describe('shareRecordingFile', () => {
  it('元ファイルを書き出し用の名前でキャッシュへ複製して共有する', async () => {
    fs.getInfoAsync.mockImplementation(
      async (uri) =>
        ({
          exists: uri === 'file:///doc/recordings/s-1.m4a',
        }) as FileSystem.FileInfo,
    );

    const result = await shareRecordingFile('file:///doc/recordings/s-1.m4a', 'rec.m4a');

    expect(result).toEqual({ ok: true });
    expect(fs.copyAsync).toHaveBeenCalledWith({
      from: 'file:///doc/recordings/s-1.m4a',
      to: 'file:///cache/export/rec.m4a',
    });
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/export/rec.m4a',
      expect.objectContaining({ mimeType: 'audio/mp4' }),
    );
    expect(fs.deleteAsync).not.toHaveBeenCalledWith('file:///doc/recordings/s-1.m4a');
  });

  it('端末に録音ファイルが無ければ共有せず error', async () => {
    const result = await shareRecordingFile('file:///doc/recordings/missing.m4a', 'rec.m4a');
    expect(result).toEqual({ ok: false, reason: 'error' });
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('shareTextFile', () => {
  it('書き込んだファイルを CSV の MIME で共有する', async () => {
    const result = await shareTextFile('a.csv', 'x,y', 'csv');
    expect(result).toEqual({ ok: true });
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/export/a.csv', 'x,y');
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/export/a.csv',
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
  });

  it('共有機能が使えない端末では unavailable', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    expect(await shareTextFile('a.txt', 'x', 'text')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('書き込み失敗は error', async () => {
    fs.writeAsStringAsync.mockRejectedValueOnce(new Error('disk full'));
    expect(await shareTextFile('a.txt', 'x', 'text')).toEqual({ ok: false, reason: 'error' });
  });
});
