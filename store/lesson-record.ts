import { create } from 'zustand';

import { combineDateTime, type LessonRecordInput } from '@/forms/lesson-record';
import { deleteRecording, finalizeRecording } from '@/lib/recording';
import { supabase } from '@/lib/supabase';

export type LessonRecord = {
  id: string;
  heldAt: string;
  advice: string | null;
  notes: string | null;
};

type LessonRecordRow = {
  id: string;
  held_at: string;
  advice: string | null;
  notes: string | null;
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
      .select('id, held_at, advice, notes')
      .order('held_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as LessonRecordRow[];
    set({
      records: rows.map((row) => ({
        id: row.id,
        heldAt: row.held_at,
        advice: row.advice,
        notes: row.notes,
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
    if (tempRecordingUri) {
      try {
        await finalizeRecording(row.id);
      } catch {
        // 録音失敗でも記録は保存
      }
    }
    set({
      records: [
        { id: row.id, heldAt: row.held_at, advice: row.advice, notes: row.notes },
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
