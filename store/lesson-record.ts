import { create } from 'zustand';

import type { HomeworkInput, HomeworkStatus } from '@/forms/homework';
import { combineDateTime, type LessonRecordInput } from '@/forms/lesson-record';
import { deleteRecording, finalizeRecording } from '@/lib/recording';
import { supabase } from '@/lib/supabase';
import type { SessionRecording } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

type TempRecording = { tempUri: string; memo: string };

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  durationMinutes: number | null;
  tempoBpm: number | null;
};

export type Homework = {
  id: string;
  content: string;
  dueDate: string | null;
  textbookId: string | null;
  textbookTitle: string;
  reviewNote: string | null;
  status: HomeworkStatus;
  completedAt: string | null;
};

type HomeworkRow = {
  id: string;
  content: string;
  due_date: string | null;
  textbook_id: string | null;
  review_note: string | null;
  status: HomeworkStatus;
  completed_at: string | null;
  textbooks: { title: string } | null;
};

function mapHomework(row: HomeworkRow): Homework {
  return {
    id: row.id,
    content: row.content,
    dueDate: row.due_date,
    textbookId: row.textbook_id,
    textbookTitle: row.textbooks?.title ?? '',
    reviewNote: row.review_note,
    status: row.status,
    completedAt: row.completed_at,
  };
}

const HOMEWORK_SELECT =
  'id, content, due_date, textbook_id, review_note, status, completed_at, textbooks ( title )';

export type MutationResult = { ok: true } | { ok: false; reason: 'unknown' };

export type LessonRecord = {
  id: string;
  heldAt: string;
  advice: string | null;
  notes: string | null;
  textbookEntries: TextbookEntry[];
  recordings: SessionRecording[];
  homework: Homework[];
};

type LessonRecordTextbookRow = {
  textbook_id: string;
  current_page: number;
  duration_minutes: number | null;
  tempo_bpm: number | null;
  textbooks: { title: string } | null;
};

type LessonRecordRow = {
  id: string;
  held_at: string;
  advice: string | null;
  notes: string | null;
  lesson_record_textbooks: LessonRecordTextbookRow[];
  lesson_record_recordings: {
    id: string;
    index: number;
    local_uri: string;
    memo: string | null;
  }[];
  lesson_homework: HomeworkRow[];
};

type LessonRecordState = {
  records: LessonRecord[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: LessonRecordInput, tempRecordings?: TempRecording[]) => Promise<void>;
  update: (
    id: string,
    input: LessonRecordInput,
    tempRecordings?: TempRecording[],
    deletedRecordingIds?: string[],
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  insertRecording: (
    lessonRecordId: string,
    srcUri: string,
    memo: string | null,
  ) => Promise<SessionRecording | null>;
  deleteRecordingRow: (lessonRecordId: string, recordingId: string) => Promise<void>;
  addHomework: (lessonRecordId: string, input: HomeworkInput) => Promise<MutationResult>;
  updateHomework: (id: string, input: HomeworkInput) => Promise<MutationResult>;
  updateHomeworkStatus: (id: string, status: HomeworkStatus) => Promise<void>;
  removeHomework: (id: string) => Promise<void>;
};

export const useLessonRecordStore = create<LessonRecordState>()((set, get) => ({
  records: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('lesson_records')
      .select(
        'id, held_at, advice, notes, ' +
          'lesson_record_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title ) ), ' +
          'lesson_record_recordings ( id, index, local_uri, memo ), ' +
          'lesson_homework ( ' +
          HOMEWORK_SELECT +
          ' )',
      )
      .order('held_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as unknown as LessonRecordRow[];
    set({
      records: rows.map((row) => ({
        id: row.id,
        heldAt: row.held_at,
        advice: row.advice,
        notes: row.notes,
        textbookEntries: (row.lesson_record_textbooks ?? []).map((entry) => ({
          textbookId: entry.textbook_id,
          textbookTitle: entry.textbooks?.title ?? '',
          currentPage: entry.current_page,
          durationMinutes: entry.duration_minutes ?? null,
          tempoBpm: entry.tempo_bpm ?? null,
        })),
        recordings: (row.lesson_record_recordings ?? []).map((r) => ({
          id: r.id,
          index: r.index as 1 | 2 | 3,
          localUri: r.local_uri,
          memo: r.memo,
        })),
        homework: (row.lesson_homework ?? []).map(mapHomework),
      })),
    });
  },

  add: async (input: LessonRecordInput, tempRecordings?: TempRecording[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data, error } = await supabase
      .from('lesson_records')
      .insert({
        user_id: userData.user.id,
        held_at: combineDateTime(input.date, input.time),
        advice: input.advice || null,
        notes: input.notes || null,
      })
      .select('id, held_at, advice, notes')
      .single();
    if (error || !data) return;

    const row = data as LessonRecordRow;

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('lesson_record_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          lesson_record_id: row.id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
          tempo_bpm: entry.tempoBpm ?? null,
        })),
      );
      if (entriesError) {
        await supabase.from('lesson_records').delete().eq('id', row.id);
        return;
      }
      for (const entry of input.textbookEntries) {
        try {
          await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
        } catch {
          // 進捗更新失敗はレッスン記録の保存に影響しない
        }
      }
    }

    const recordings: SessionRecording[] = [];
    if (tempRecordings && tempRecordings.length > 0) {
      for (let i = 0; i < tempRecordings.length; i++) {
        const index = (i + 1) as 1 | 2 | 3;
        try {
          const destUri = await finalizeRecording(tempRecordings[i].tempUri, row.id, index);
          const { data: recData } = await supabase
            .from('lesson_record_recordings')
            .insert({
              lesson_record_id: row.id,
              index,
              local_uri: destUri,
              memo: tempRecordings[i].memo || null,
            })
            .select('id')
            .single();
          if (recData) {
            recordings.push({
              id: recData.id,
              index,
              localUri: destUri,
              memo: tempRecordings[i].memo || null,
            });
          }
        } catch {
          // 録音保存失敗はレッスン記録の保存に影響しない
        }
      }
    }

    set({
      records: [
        {
          id: row.id,
          heldAt: row.held_at,
          advice: row.advice,
          notes: row.notes,
          textbookEntries: input.textbookEntries.map((entry) => {
            const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
            return {
              textbookId: entry.textbookId,
              textbookTitle: tb?.title ?? '',
              currentPage: entry.currentPage,
              durationMinutes: entry.durationMinutes ?? null,
              tempoBpm: entry.tempoBpm ?? null,
            };
          }),
          recordings,
          homework: [],
        },
        ...get().records,
      ],
    });
  },

  update: async (
    id: string,
    input: LessonRecordInput,
    tempRecordings?: TempRecording[],
    deletedRecordingIds?: string[],
  ) => {
    const { error } = await supabase
      .from('lesson_records')
      .update({
        held_at: combineDateTime(input.date, input.time),
        advice: input.advice || null,
        notes: input.notes || null,
      })
      .eq('id', id);
    if (error) return;

    const { error: deleteError } = await supabase
      .from('lesson_record_textbooks')
      .delete()
      .eq('lesson_record_id', id);
    if (deleteError) return;

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;

    if (input.textbookEntries.length > 0) {
      const { error: insertError } = await supabase.from('lesson_record_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          lesson_record_id: id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
          tempo_bpm: entry.tempoBpm ?? null,
        })),
      );
      if (insertError) return;
      for (const entry of input.textbookEntries) {
        try {
          await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
        } catch {
          // 進捗更新失敗はレッスン記録の保存に影響しない
        }
      }
    }

    const record = get().records.find((r) => r.id === id);
    if (deletedRecordingIds && deletedRecordingIds.length > 0) {
      for (const delId of deletedRecordingIds) {
        const rec = record?.recordings.find((r) => r.id === delId);
        if (rec) await deleteRecording(rec.localUri);
      }
      await supabase.from('lesson_record_recordings').delete().in('id', deletedRecordingIds);
    }

    const remainingRecordings = (record?.recordings ?? []).filter(
      (r) => !deletedRecordingIds?.includes(r.id),
    );
    const usedIndices = new Set(remainingRecordings.map((r) => r.index));
    const availableIndices = ([1, 2, 3] as const).filter((i) => !usedIndices.has(i));
    const newRecordings: SessionRecording[] = [];

    if (tempRecordings && tempRecordings.length > 0) {
      for (let i = 0; i < tempRecordings.length; i++) {
        const index = availableIndices[i];
        try {
          const destUri = await finalizeRecording(tempRecordings[i].tempUri, id, index);
          const { data: recData } = await supabase
            .from('lesson_record_recordings')
            .insert({
              lesson_record_id: id,
              index,
              local_uri: destUri,
              memo: tempRecordings[i].memo || null,
            })
            .select('id')
            .single();
          if (recData) {
            newRecordings.push({
              id: recData.id,
              index,
              localUri: destUri,
              memo: tempRecordings[i].memo || null,
            });
          }
        } catch {
          // 録音保存失敗はレッスン記録の保存に影響しない
        }
      }
    }

    const updatedRecordings = [...remainingRecordings, ...newRecordings];

    set({
      records: get().records.map((r) =>
        r.id === id
          ? {
              ...r,
              heldAt: combineDateTime(input.date, input.time),
              advice: input.advice || null,
              notes: input.notes || null,
              textbookEntries: input.textbookEntries.map((entry) => {
                const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
                return {
                  textbookId: entry.textbookId,
                  textbookTitle: tb?.title ?? '',
                  currentPage: entry.currentPage,
                  durationMinutes: entry.durationMinutes ?? null,
                  tempoBpm: entry.tempoBpm ?? null,
                };
              }),
              recordings: updatedRecordings,
            }
          : r,
      ),
    });
  },

  remove: async (id: string) => {
    const record = get().records.find((r) => r.id === id);
    for (const rec of record?.recordings ?? []) {
      await deleteRecording(rec.localUri);
    }
    const { error } = await supabase.from('lesson_records').delete().eq('id', id);
    if (error) return;
    set({ records: get().records.filter((r) => r.id !== id) });
  },

  // 既存ファイルを当レッスン記録へ移し DB 行を追加する (録音の記録間移動の移動先側)。
  insertRecording: async (lessonRecordId, srcUri, memo) => {
    const record = get().records.find((r) => r.id === lessonRecordId);
    if (!record) return null;
    const usedIndices = new Set(record.recordings.map((r) => r.index));
    const index = ([1, 2, 3] as const).find((i) => !usedIndices.has(i));
    if (index == null) return null;

    const destUri = await finalizeRecording(srcUri, lessonRecordId, index);
    const { data: recData } = await supabase
      .from('lesson_record_recordings')
      .insert({ lesson_record_id: lessonRecordId, index, local_uri: destUri, memo: memo || null })
      .select('id')
      .single();
    if (!recData) return null;

    const newRec: SessionRecording = {
      id: recData.id,
      index,
      localUri: destUri,
      memo: memo || null,
    };
    set({
      records: get().records.map((r) =>
        r.id === lessonRecordId ? { ...r, recordings: [...r.recordings, newRec] } : r,
      ),
    });
    return newRec;
  },

  // DB 行のみ削除する (移動元側)。ファイルは移動済みのため削除しない。
  deleteRecordingRow: async (lessonRecordId, recordingId) => {
    await supabase.from('lesson_record_recordings').delete().eq('id', recordingId);
    set({
      records: get().records.map((r) =>
        r.id === lessonRecordId
          ? { ...r, recordings: r.recordings.filter((rec) => rec.id !== recordingId) }
          : r,
      ),
    });
  },

  addHomework: async (lessonRecordId, input) => {
    const completedAt = input.status === 'done' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('lesson_homework')
      .insert({
        lesson_record_id: lessonRecordId,
        content: input.content,
        due_date: input.dueDate || null,
        textbook_id: input.textbookId || null,
        review_note: input.reviewNote || null,
        status: input.status,
        completed_at: completedAt,
      })
      .select(HOMEWORK_SELECT)
      .single();
    if (error || !data) return { ok: false, reason: 'unknown' };
    const hw = mapHomework(data as unknown as HomeworkRow);
    set({
      records: get().records.map((r) =>
        r.id === lessonRecordId ? { ...r, homework: [...r.homework, hw] } : r,
      ),
    });
    return { ok: true };
  },

  updateHomework: async (id, input) => {
    const completedAt = input.status === 'done' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('lesson_homework')
      .update({
        content: input.content,
        due_date: input.dueDate || null,
        textbook_id: input.textbookId || null,
        review_note: input.reviewNote || null,
        status: input.status,
        completed_at: completedAt,
      })
      .eq('id', id)
      .select(HOMEWORK_SELECT)
      .single();
    if (error || !data) return { ok: false, reason: 'unknown' };
    const hw = mapHomework(data as unknown as HomeworkRow);
    set({
      records: get().records.map((r) => ({
        ...r,
        homework: r.homework.map((h) => (h.id === id ? hw : h)),
      })),
    });
    return { ok: true };
  },

  updateHomeworkStatus: async (id, status) => {
    const completedAt = status === 'done' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('lesson_homework')
      .update({ status, completed_at: completedAt })
      .eq('id', id)
      .select(HOMEWORK_SELECT)
      .single();
    if (error || !data) return;
    const hw = mapHomework(data as unknown as HomeworkRow);
    set({
      records: get().records.map((r) => ({
        ...r,
        homework: r.homework.map((h) => (h.id === id ? hw : h)),
      })),
    });
  },

  removeHomework: async (id) => {
    const { error } = await supabase.from('lesson_homework').delete().eq('id', id);
    if (error) return;
    set({
      records: get().records.map((r) => ({
        ...r,
        homework: r.homework.filter((h) => h.id !== id),
      })),
    });
  },
}));
