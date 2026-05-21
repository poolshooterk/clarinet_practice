import { create } from 'zustand';

import { combineDateTime, type LessonRecordInput } from '@/forms/lesson-record';
import { deleteRecording, finalizeRecording } from '@/lib/recording';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  durationMinutes: number | null;
  tempoBpm: number | null;
};

export type LessonRecord = {
  id: string;
  heldAt: string;
  advice: string | null;
  notes: string | null;
  textbookEntries: TextbookEntry[];
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
};

type LessonRecordState = {
  records: LessonRecord[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: LessonRecordInput, tempRecordingUri?: string | null) => Promise<void>;
  update: (id: string, input: LessonRecordInput, tempRecordingUri?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
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
          'lesson_record_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title ) )',
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
      })),
    });
  },

  add: async (input: LessonRecordInput, tempRecordingUri?: string | null) => {
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
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    if (tempRecordingUri) {
      try {
        await finalizeRecording(row.id);
      } catch {
        // 録音失敗でも記録は保存
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
        },
        ...get().records,
      ],
    });
  },

  update: async (id: string, input: LessonRecordInput, tempRecordingUri?: string | null) => {
    const { error } = await supabase
      .from('lesson_records')
      .update({
        held_at: combineDateTime(input.date, input.time),
        advice: input.advice || null,
        notes: input.notes || null,
      })
      .eq('id', id);
    if (error) return;

    await supabase.from('lesson_record_textbooks').delete().eq('lesson_record_id', id);

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;

    if (input.textbookEntries.length > 0) {
      await supabase.from('lesson_record_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          lesson_record_id: id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
          tempo_bpm: entry.tempoBpm ?? null,
        })),
      );
      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    if (tempRecordingUri) {
      try {
        await finalizeRecording(id);
      } catch {
        // 録音失敗でも記録は保存
      }
    }
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
            }
          : r,
      ),
    });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('lesson_records').delete().eq('id', id);
    if (error) return;
    await deleteRecording(id);
    set({ records: get().records.filter((r) => r.id !== id) });
  },
}));
