import { splitHeldAt } from '@/forms/lesson-record';
import { BASIC_MENUS } from '@/forms/practice-log';
import type { LessonRecord } from '@/store/lesson-record';
import type { PracticeSession, SessionRecording } from '@/store/practice-log';

// 書き出し (外部アプリへの共有) 用の純粋な整形関数。
// ファイル I/O と共有シートの呼び出しは lib/export.ts 側に置く。

const HOMEWORK_STATUS_LABEL = {
  not_started: '未着手',
  in_progress: '取り組み中',
  done: '完了',
} as const;

function menuLabel(menuType: string): string {
  return BASIC_MENUS.find((m) => m.type === menuType)?.label ?? menuType;
}

function totalMinutesOf(session: PracticeSession): number {
  if (session.totalMinutes != null) return session.totalMinutes;
  return (
    session.basicMenuEntries.reduce((acc, e) => acc + e.durationMinutes, 0) +
    session.textbookEntries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0) +
    (session.otherMinutes ?? 0)
  );
}

function recordingLines(recordings: SessionRecording[]): string[] {
  if (recordings.length === 0) return [];
  return [
    '',
    '■ 録音',
    ...[...recordings]
      .sort((a, b) => a.index - b.index)
      .map((r, i) => `- 録音 ${i + 1}${r.memo ? `: ${r.memo}` : ''}`),
  ];
}

/** 練習記録 1 件をテキストにする (共有シートでメモ/ドキュメントとして保存する用途) */
export function formatPracticeSessionText(session: PracticeSession): string {
  const lines: string[] = [`練習記録 ${session.practicedAt} (${session.sessionNo}回目)`];
  if (session.startTime || session.endTime) {
    lines.push(`時間: ${session.startTime ?? ''}〜${session.endTime ?? ''}`);
  }
  lines.push(`合計: ${totalMinutesOf(session)}分`);
  if (session.reedNumber) lines.push(`リード: ${session.reedNumber}`);

  if (session.basicMenuEntries.length > 0) {
    lines.push('', '■ 基礎練習');
    for (const e of session.basicMenuEntries) {
      const tempo = e.tempoBpms.length > 0 ? ` / テンポ ${e.tempoBpms.join(', ')}` : '';
      lines.push(`- ${menuLabel(e.menuType)}: ${e.durationMinutes}分${tempo}`);
    }
  }

  if (session.textbookEntries.length > 0) {
    lines.push('', '■ 教本');
    for (const e of session.textbookEntries) {
      const parts = [`p.${e.currentPage}`];
      if (e.durationMinutes != null) parts.push(`${e.durationMinutes}分`);
      if (e.tempoBpm != null) parts.push(`テンポ ${e.tempoBpm}`);
      lines.push(`- ${e.textbookTitle}: ${parts.join(' / ')}`);
    }
  }

  if (session.otherMinutes != null || session.otherMemo) {
    lines.push('', '■ その他');
    const minutes = session.otherMinutes != null ? `${session.otherMinutes}分` : '';
    lines.push(`- ${[minutes, session.otherMemo ?? ''].filter(Boolean).join(' / ')}`);
  }

  if (session.memo) lines.push('', '■ メモ', session.memo);
  lines.push(...recordingLines(session.recordings));
  return lines.join('\n') + '\n';
}

/** レッスン記録 1 件をテキストにする */
export function formatLessonRecordText(record: LessonRecord): string {
  const { date, time } = splitHeldAt(record.heldAt);
  const lines: string[] = [`レッスン記録 ${date} ${time}`];

  if (record.textbookEntries.length > 0) {
    lines.push('', '■ 教本');
    for (const e of record.textbookEntries) {
      const parts = [`p.${e.currentPage}`];
      if (e.durationMinutes != null) parts.push(`${e.durationMinutes}分`);
      if (e.tempoBpm != null) parts.push(`テンポ ${e.tempoBpm}`);
      lines.push(`- ${e.textbookTitle}: ${parts.join(' / ')}`);
    }
  }

  if (record.advice) lines.push('', '■ 先生からのアドバイス', record.advice);
  if (record.notes) lines.push('', '■ メモ', record.notes);

  if (record.homework.length > 0) {
    lines.push('', '■ 宿題');
    for (const h of record.homework) {
      const meta: string[] = [HOMEWORK_STATUS_LABEL[h.status]];
      if (h.textbookTitle) meta.push(h.textbookTitle);
      if (h.dueDate) meta.push(`期限 ${h.dueDate}`);
      lines.push(`- ${h.content} (${meta.join(' / ')})`);
      if (h.reviewNote) lines.push(`  振り返り: ${h.reviewNote}`);
    }
  }

  lines.push(...recordingLines(record.recordings));
  return lines.join('\n') + '\n';
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  // 先頭 BOM は Excel で UTF-8 の日本語を文字化けさせないため (Google スプレッドシートは無視する)
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** 練習記録の一覧を CSV にする (1 行 = 1 セッション)。日付昇順 */
export function buildPracticeSessionsCsv(sessions: PracticeSession[]): string {
  const sorted = [...sessions].sort(
    (a, b) => a.practicedAt.localeCompare(b.practicedAt) || a.sessionNo - b.sessionNo,
  );
  const header = [
    '日付',
    '回',
    '開始',
    '終了',
    '合計(分)',
    '基礎練習',
    '教本',
    'その他(分)',
    'その他メモ',
    'リード',
    'メモ',
    '録音数',
  ];
  const rows = sorted.map((s) => [
    s.practicedAt,
    s.sessionNo,
    s.startTime,
    s.endTime,
    totalMinutesOf(s),
    s.basicMenuEntries.map((e) => `${menuLabel(e.menuType)} ${e.durationMinutes}分`).join(' / '),
    s.textbookEntries
      .map(
        (e) =>
          `${e.textbookTitle} p.${e.currentPage}` +
          (e.durationMinutes != null ? ` ${e.durationMinutes}分` : ''),
      )
      .join(' / '),
    s.otherMinutes,
    s.otherMemo,
    s.reedNumber,
    s.memo,
    s.recordings.length,
  ]);
  return toCsv([header, ...rows]);
}

/** レッスン記録の一覧を CSV にする (1 行 = 1 レッスン)。日時昇順 */
export function buildLessonRecordsCsv(records: LessonRecord[]): string {
  const sorted = [...records].sort((a, b) => a.heldAt.localeCompare(b.heldAt));
  const header = ['日付', '時刻', '教本', 'アドバイス', 'メモ', '宿題', '録音数'];
  const rows = sorted.map((r) => {
    const { date, time } = splitHeldAt(r.heldAt);
    return [
      date,
      time,
      r.textbookEntries.map((e) => `${e.textbookTitle} p.${e.currentPage}`).join(' / '),
      r.advice,
      r.notes,
      r.homework.map((h) => `${h.content} (${HOMEWORK_STATUS_LABEL[h.status]})`).join(' / '),
      r.recordings.length,
    ];
  });
  return toCsv([header, ...rows]);
}

/**
 * 共有先に渡すファイル名。端末内の `{recordId}-{index}.m4a` は中身が分からないため、
 * 日付入りの名前に付け替える。共有先アプリの互換性を優先して ASCII のみで組み立てる。
 */
export function recordingExportFileName(
  kind: 'practice' | 'lesson',
  date: string,
  recordingNo: number,
  sessionNo?: number,
): string {
  const session = sessionNo != null ? `_${sessionNo}` : '';
  return `clarinet_${kind}_${date}${session}_rec${recordingNo}.m4a`;
}
