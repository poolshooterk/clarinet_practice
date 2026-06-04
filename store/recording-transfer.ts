import { type LessonRecord, useLessonRecordStore } from '@/store/lesson-record';
import {
  type PracticeSession,
  type SessionRecording,
  usePracticeLogStore,
} from '@/store/practice-log';

export type RecordKind = 'practice' | 'lesson';

const MAX_RECORDINGS = 3;

type MoveParams = {
  sourceType: RecordKind;
  sourceRecordId: string;
  recording: SessionRecording;
  targetType: RecordKind;
  targetRecordId: string;
};

// 録音を別の記録 (練習/レッスン、種別をまたぐ全記録) へ移動する。
// 移動先へファイル移動 + DB 行挿入を先に行い、成功したら移動元の DB 行を削除する。
// 移動元のファイルは移動済みのため deleteRecordingRow では消さない。
export async function moveRecording(params: MoveParams): Promise<{ ok: boolean }> {
  const { sourceType, sourceRecordId, recording, targetType, targetRecordId } = params;

  const targetInsert =
    targetType === 'practice'
      ? usePracticeLogStore.getState().insertRecording
      : useLessonRecordStore.getState().insertRecording;
  const sourceDelete =
    sourceType === 'practice'
      ? usePracticeLogStore.getState().deleteRecordingRow
      : useLessonRecordStore.getState().deleteRecordingRow;

  const newRec = await targetInsert(targetRecordId, recording.localUri, recording.memo);
  if (!newRec) return { ok: false };

  await sourceDelete(sourceRecordId, recording.id);
  return { ok: true };
}

export type MoveCandidate = { kind: RecordKind; id: string; date: string; label: string };

// 録音の移動先候補を組み立てる。自記録と満杯 (録音3件) の記録を除外し、日付の新しい順に並べる。
export function buildMoveCandidates(
  sessions: PracticeSession[],
  records: LessonRecord[],
  sourceType: RecordKind,
  sourceRecordId: string,
): MoveCandidate[] {
  const isSelf = (kind: RecordKind, id: string) => kind === sourceType && id === sourceRecordId;

  const practiceCandidates: MoveCandidate[] = sessions
    .filter((s) => !isSelf('practice', s.id) && s.recordings.length < MAX_RECORDINGS)
    .map((s) => ({
      kind: 'practice',
      id: s.id,
      date: s.practicedAt,
      label: `練習 ${s.practicedAt}`,
    }));

  const lessonCandidates: MoveCandidate[] = records
    .filter((r) => !isSelf('lesson', r.id) && r.recordings.length < MAX_RECORDINGS)
    .map((r) => ({
      kind: 'lesson',
      id: r.id,
      date: r.heldAt,
      label: `レッスン ${r.heldAt.slice(0, 10)}`,
    }));

  return [...practiceCandidates, ...lessonCandidates].sort((a, b) => b.date.localeCompare(a.date));
}
