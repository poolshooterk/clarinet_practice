import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// OS の共有シート経由で録音・記録を外部アプリ (Google ドライブ / ファイル / メール等) へ書き出す。
// 保存先はユーザが共有シートで選ぶため、特定サービスの API・認証には依存しない。

const EXPORT_DIR = `${FileSystem.cacheDirectory}export/`;

export type ExportResult = { ok: true } | { ok: false; reason: 'unavailable' | 'error' };

async function prepareExportFile(fileName: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
  const dest = `${EXPORT_DIR}${fileName}`;
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
  return dest;
}

async function share(
  uri: string,
  options: { mimeType: string; UTI: string; dialogTitle: string },
): Promise<ExportResult> {
  if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };
  await Sharing.shareAsync(uri, options);
  return { ok: true };
}

/** 録音ファイルを分かりやすい名前でキャッシュへ複製してから共有する (元ファイルは触らない) */
export async function shareRecordingFile(srcUri: string, fileName: string): Promise<ExportResult> {
  try {
    const src = await FileSystem.getInfoAsync(srcUri);
    if (!src.exists) return { ok: false, reason: 'error' };
    const dest = await prepareExportFile(fileName);
    await FileSystem.copyAsync({ from: srcUri, to: dest });
    return await share(dest, {
      mimeType: 'audio/mp4',
      UTI: 'public.mpeg-4-audio',
      dialogTitle: '録音を書き出す',
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** テキスト (記録のまとめ / CSV) をファイルに書いて共有する */
export async function shareTextFile(
  fileName: string,
  content: string,
  kind: 'text' | 'csv',
): Promise<ExportResult> {
  try {
    const dest = await prepareExportFile(fileName);
    await FileSystem.writeAsStringAsync(dest, content);
    return await share(
      dest,
      kind === 'csv'
        ? {
            mimeType: 'text/csv',
            UTI: 'public.comma-separated-values-text',
            dialogTitle: 'CSV を書き出す',
          }
        : { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: '記録を書き出す' },
    );
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** 書き出し失敗時に表示する文言 */
export function exportErrorMessage(reason: 'unavailable' | 'error'): string {
  return reason === 'unavailable'
    ? 'この端末では共有機能を利用できません。'
    : '書き出し中にエラーが発生しました。時間を置いて再度お試しください。';
}
