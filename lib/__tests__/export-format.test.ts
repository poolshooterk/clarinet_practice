import {
  buildLessonRecordsCsv,
  buildPracticeSessionsCsv,
  formatLessonRecordText,
  formatPracticeSessionText,
  recordingExportFileName,
} from '@/lib/export-format';
import type { LessonRecord } from '@/store/lesson-record';
import type { PracticeSession } from '@/store/practice-log';

function makeSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: 's-1',
    practicedAt: '2026-09-20',
    sessionNo: 1,
    durationMinutes: 15,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: 45,
    memo: null,
    reedNumber: null,
    startTime: null,
    endTime: null,
    textbookEntries: [],
    basicMenuEntries: [],
    recordings: [],
    ...overrides,
  };
}

function makeLesson(overrides: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'l-1',
    // オフセット無しの ISO は端末ローカル時刻として解釈される (TZ に依存させない)
    heldAt: '2026-09-21T10:30:00',
    advice: null,
    notes: null,
    textbookEntries: [],
    recordings: [],
    homework: [],
    ...overrides,
  };
}

describe('formatPracticeSessionText', () => {
  it('全項目をセクションごとに出力する', () => {
    const text = formatPracticeSessionText(
      makeSession({
        sessionNo: 2,
        startTime: '19:00',
        endTime: '19:45',
        reedNumber: 'A3',
        basicMenuEntries: [
          { menuType: 'long_tone', durationMinutes: 10, tempoBpms: [] },
          { menuType: 'tonguing', durationMinutes: 5, tempoBpms: [80, 96] },
        ],
        textbookEntries: [
          {
            textbookId: 't-1',
            textbookTitle: 'ローズ32',
            currentPage: 12,
            totalPages: 40,
            genre: 'エチュード',
            durationMinutes: 20,
            tempoBpm: 72,
          },
        ],
        otherMinutes: 10,
        otherMemo: '曲練習',
        memo: '高音が安定してきた',
        recordings: [
          { id: 'r-3', index: 3, localUri: 'x', memo: null },
          { id: 'r-1', index: 1, localUri: 'y', memo: '通し' },
        ],
      }),
    );
    expect(text).toBe(
      [
        '練習記録 2026-09-20 (2回目)',
        '時間: 19:00〜19:45',
        '合計: 45分',
        'リード: A3',
        '',
        '■ 基礎練習',
        '- ロングトーン: 10分',
        '- タンギング: 5分 / テンポ 80, 96',
        '',
        '■ 教本',
        '- ローズ32: p.12 / 20分 / テンポ 72',
        '',
        '■ その他',
        '- 10分 / 曲練習',
        '',
        '■ メモ',
        '高音が安定してきた',
        '',
        '■ 録音',
        '- 録音 1: 通し',
        '- 録音 2',
        '',
      ].join('\n'),
    );
  });

  it('空のセクションは出さず、totalMinutes が無ければ内訳から合計する', () => {
    const text = formatPracticeSessionText(
      makeSession({
        totalMinutes: null,
        basicMenuEntries: [{ menuType: 'long_tone', durationMinutes: 10, tempoBpms: [] }],
        otherMinutes: 5,
      }),
    );
    expect(text).toContain('合計: 15分');
    expect(text).not.toContain('■ 教本');
    expect(text).not.toContain('■ 録音');
    expect(text).not.toContain('時間:');
  });
});

describe('formatLessonRecordText', () => {
  it('アドバイス・宿題・録音を出力する', () => {
    const text = formatLessonRecordText(
      makeLesson({
        advice: '息のスピードを保つ',
        textbookEntries: [
          {
            textbookId: 't-1',
            textbookTitle: 'ランスロ',
            currentPage: 5,
            durationMinutes: null,
            tempoBpm: null,
          },
        ],
        homework: [
          {
            id: 'h-1',
            content: 'スケール Es-dur',
            dueDate: '2026-09-28',
            textbookId: null,
            textbookTitle: '',
            reviewNote: '8分音符が走る',
            status: 'in_progress',
            completedAt: null,
          },
        ],
        recordings: [{ id: 'r-1', index: 1, localUri: 'x', memo: null }],
      }),
    );
    expect(text).toContain('レッスン記録 2026-09-21 10:30');
    expect(text).toContain('- ランスロ: p.5');
    expect(text).toContain('■ 先生からのアドバイス\n息のスピードを保つ');
    expect(text).toContain(
      '- スケール Es-dur (取り組み中 / 期限 2026-09-28)\n  振り返り: 8分音符が走る',
    );
    expect(text).toContain('■ 録音\n- 録音 1');
    expect(text).not.toContain('■ メモ');
  });
});

describe('buildPracticeSessionsCsv', () => {
  it('BOM 付き・CRLF・日付昇順で出力し、カンマや改行を含む値をクォートする', () => {
    const csv = buildPracticeSessionsCsv([
      makeSession({ id: 'b', practicedAt: '2026-09-21', memo: 'a,"b"\nc' }),
      makeSession({ id: 'a2', practicedAt: '2026-09-20', sessionNo: 2 }),
      makeSession({ id: 'a1', practicedAt: '2026-09-20', sessionNo: 1 }),
    ]);
    expect(csv.startsWith('﻿日付,回,')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1].startsWith('2026-09-20,1,')).toBe(true);
    expect(lines[2].startsWith('2026-09-20,2,')).toBe(true);
    expect(lines[3]).toContain('"a,""b""\nc"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('記録 0 件ならヘッダ行だけ', () => {
    expect(buildPracticeSessionsCsv([]).slice(1).split('\r\n')).toHaveLength(2);
  });
});

describe('buildLessonRecordsCsv', () => {
  it('1 行 = 1 レッスンで日付・時刻・宿題をまとめる', () => {
    const csv = buildLessonRecordsCsv([
      makeLesson({
        homework: [
          {
            id: 'h-1',
            content: 'ロングトーン',
            dueDate: null,
            textbookId: null,
            textbookTitle: '',
            reviewNote: null,
            status: 'done',
            completedAt: null,
          },
        ],
      }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('日付,時刻,教本,アドバイス,メモ,宿題,録音数');
    expect(lines[1]).toBe('2026-09-21,10:30,,,,ロングトーン (完了),0');
  });
});

describe('recordingExportFileName', () => {
  it('練習は回番号付き、レッスンは回番号なし', () => {
    expect(recordingExportFileName('practice', '2026-09-20', 2, 1)).toBe(
      'clarinet_practice_2026-09-20_1_rec2.m4a',
    );
    expect(recordingExportFileName('lesson', '2026-09-21', 1)).toBe(
      'clarinet_lesson_2026-09-21_rec1.m4a',
    );
  });
});
