import { buildDayMap } from '@/components/practice-chart';
import type { PracticeSession } from '@/store/practice-log';

function makeSession(
  id: string,
  practicedAt: string,
  durationMinutes: number | null,
): PracticeSession {
  return {
    id,
    practicedAt,
    durationMinutes,
    otherMinutes: null,
    memo: null,
    textbookEntries: [],
    basicMenuEntries: [],
  };
}

describe('buildDayMap', () => {
  it('指定月のセッションのみ集計する', () => {
    const sessions = [makeSession('1', '2026-05-10', 30), makeSession('2', '2026-04-20', 45)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result[10]).toBe(30);
    expect(result[20]).toBeUndefined();
  });

  it('同日の複数セッションを合算する', () => {
    const sessions = [makeSession('1', '2026-05-10', 20), makeSession('2', '2026-05-10', 15)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result[10]).toBe(35);
  });

  it('durationMinutes が null のセッションはスキップする', () => {
    const sessions = [makeSession('1', '2026-05-01', null)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result).toEqual({});
  });

  it('durationMinutes が 0 のセッションはスキップする', () => {
    const sessions = [makeSession('1', '2026-05-01', 0)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result).toEqual({});
  });

  it('セッションが空のとき空のマップを返す', () => {
    expect(buildDayMap([], '2026-05')).toEqual({});
  });

  it('指定月にセッションがないとき空のマップを返す', () => {
    const sessions = [makeSession('1', '2026-04-10', 30)];
    expect(buildDayMap(sessions, '2026-05')).toEqual({});
  });
});
