import { create } from 'zustand';

import { BASIC_GENRES, type PracticeLogInput } from '@/forms/practice-log';
import { deleteRecording, finalizeRecording } from '@/lib/recording';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

function computeMaxTempo(tempoBpms: { bpm: number }[] | undefined): number | null {
  if (!tempoBpms || tempoBpms.length === 0) return null;
  return Math.max(...tempoBpms.map((e) => e.bpm));
}

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  genre: string;
  durationMinutes: number | null;
  tempoBpm: number | null;
};

type BasicMenuEntry = {
  menuType: string;
  durationMinutes: number;
  tempoBpms: number[];
};

export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  otherMinutes: number | null;
  otherMemo: string | null;
  totalMinutes: number | null;
  memo: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};

export function calcSessionTime(session: PracticeSession): { basic: number; nonBasic: number } {
  const basicTextbook = session.textbookEntries
    .filter((e) => (BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const textbookOnly = session.textbookEntries
    .filter((e) => !(BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  return {
    basic: (session.durationMinutes ?? 0) + basicTextbook,
    nonBasic: textbookOnly + (session.otherMinutes ?? 0),
  };
}

type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  other_minutes: number | null;
  other_memo: string | null;
  total_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    duration_minutes: number | null;
    tempo_bpm: number | null;
    textbooks: { title: string; total_pages: number | null; genre: string } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
    tempo_bpms: number[] | null;
  }[];
};

type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput, tempRecordingUri?: string | null) => Promise<void>;
  update: (id: string, input: PracticeLogInput, tempRecordingUri?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePracticeLogStore = create<PracticeLogState>()((set, get) => ({
  sessions: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('practice_sessions')
      .select(
        'id, practiced_at, duration_minutes, other_minutes, other_memo, total_minutes, memo, ' +
          'practice_session_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title, total_pages, genre ) ), ' +
          'practice_session_basic_menus ( menu_type, duration_minutes, tempo_bpms )',
      )
      .order('practiced_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as unknown as SessionRow[];
    set({
      sessions: rows.map((row) => ({
        id: row.id,
        practicedAt: row.practiced_at,
        durationMinutes: row.duration_minutes ?? null,
        otherMinutes: row.other_minutes ?? null,
        otherMemo: row.other_memo ?? null,
        totalMinutes: row.total_minutes ?? null,
        memo: row.memo ?? null,
        textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
          textbookId: entry.textbook_id,
          textbookTitle: entry.textbooks?.title ?? '',
          currentPage: entry.current_page,
          totalPages: entry.textbooks?.total_pages ?? null,
          genre: entry.textbooks?.genre ?? 'その他',
          durationMinutes: entry.duration_minutes ?? null,
          tempoBpm: entry.tempo_bpm ?? null,
        })),
        basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
          menuType: m.menu_type,
          durationMinutes: m.duration_minutes,
          tempoBpms: m.tempo_bpms ?? [],
        })),
      })),
    });
  },

  add: async (input: PracticeLogInput, tempRecordingUri?: string | null) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

    // total_minutes 計算のため先に取得（関数末尾の取得を削除）
    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const basicTextbookMinutes = input.textbookEntries
      .filter((e) => {
        const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
        return tb != null && (BASIC_GENRES as readonly string[]).includes(tb.genre);
      })
      .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
    const nonBasicMinutes =
      input.textbookEntries
        .filter((e) => {
          const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
          return tb == null || !(BASIC_GENRES as readonly string[]).includes(tb.genre);
        })
        .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0) + (input.otherMinutes ?? 0);
    const totalMinutesValue = totalDuration + basicTextbookMinutes + nonBasicMinutes || null;

    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userData.user.id,
        practiced_at: input.practicedAt,
        duration_minutes: totalDuration > 0 ? totalDuration : null,
        other_minutes: input.otherMinutes ?? null,
        other_memo: input.otherMemo || null,
        total_minutes: totalMinutesValue,
        memo: input.memo || null,
      })
      .select()
      .single();
    if (sessionError || !session) return;

    const sessionId = (session as { id: string }).id;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => {
          const maxTempo = computeMaxTempo(entry.tempoBpms);
          return {
            session_id: sessionId,
            textbook_id: entry.textbookId,
            current_page: entry.currentPage,
            duration_minutes: entry.durationMinutes ?? null,
            tempo_bpm: maxTempo,
          };
        }),
      );
      if (entriesError) {
        await supabase.from('practice_sessions').delete().eq('id', sessionId);
        return;
      }

      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    const basicMenuRows = [
      ...(input.longToneMinutes != null
        ? [
            {
              session_id: sessionId,
              menu_type: 'long_tone' as const,
              duration_minutes: input.longToneMinutes,
              tempo_bpms: null as number[] | null,
            },
          ]
        : []),
      ...(input.tonguingMinutes != null
        ? [
            {
              session_id: sessionId,
              menu_type: 'tonguing' as const,
              duration_minutes: input.tonguingMinutes,
              tempo_bpms: input.tonguingTempoBpms?.length
                ? input.tonguingTempoBpms.map((e) => e.bpm)
                : null,
            },
          ]
        : []),
    ];

    if (basicMenuRows.length > 0) {
      const { error: basicError } = await supabase
        .from('practice_session_basic_menus')
        .insert(basicMenuRows);
      if (basicError) {
        await supabase.from('practice_sessions').delete().eq('id', sessionId);
        return;
      }
    }

    const newSession: PracticeSession = {
      id: sessionId,
      practicedAt: input.practicedAt,
      durationMinutes: totalDuration > 0 ? totalDuration : null,
      otherMinutes: input.otherMinutes ?? null,
      otherMemo: input.otherMemo || null,
      totalMinutes: totalMinutesValue,
      memo: input.memo || null,
      textbookEntries: input.textbookEntries.map((entry) => {
        const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
        const maxTempo = computeMaxTempo(entry.tempoBpms);
        return {
          textbookId: entry.textbookId,
          textbookTitle: tb?.title ?? '',
          currentPage: entry.currentPage,
          totalPages: tb?.totalPages ?? null,
          genre: tb?.genre ?? 'その他',
          durationMinutes: entry.durationMinutes ?? null,
          tempoBpm: maxTempo,
        };
      }),
      basicMenuEntries: basicMenuRows.map((r) => ({
        menuType: r.menu_type,
        durationMinutes: r.duration_minutes,
        tempoBpms: r.tempo_bpms ?? [],
      })),
    };
    if (tempRecordingUri) {
      try {
        await finalizeRecording(sessionId);
      } catch {
        // 録音ファイルの保存に失敗しても練習記録の保存は継続する
      }
    }
    set({ sessions: [newSession, ...get().sessions] });
  },

  update: async (id: string, input: PracticeLogInput, tempRecordingUri?: string | null) => {
    const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

    // total_minutes 計算のため先に取得
    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const basicTextbookMinutes = input.textbookEntries
      .filter((e) => {
        const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
        return tb != null && (BASIC_GENRES as readonly string[]).includes(tb.genre);
      })
      .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
    const nonBasicMinutes =
      input.textbookEntries
        .filter((e) => {
          const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
          return tb == null || !(BASIC_GENRES as readonly string[]).includes(tb.genre);
        })
        .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0) + (input.otherMinutes ?? 0);
    const totalMinutesValue = totalDuration + basicTextbookMinutes + nonBasicMinutes || null;

    const { error: sessionError } = await supabase
      .from('practice_sessions')
      .update({
        practiced_at: input.practicedAt,
        duration_minutes: totalDuration > 0 ? totalDuration : null,
        other_minutes: input.otherMinutes ?? null,
        other_memo: input.otherMemo || null,
        total_minutes: totalMinutesValue,
        memo: input.memo || null,
      })
      .eq('id', id);
    if (sessionError) return;

    const { error: deleteTextbooksError } = await supabase
      .from('practice_session_textbooks')
      .delete()
      .eq('session_id', id);
    if (deleteTextbooksError) return;
    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => {
          const maxTempo = computeMaxTempo(entry.tempoBpms);
          return {
            session_id: id,
            textbook_id: entry.textbookId,
            current_page: entry.currentPage,
            duration_minutes: entry.durationMinutes ?? null,
            tempo_bpm: maxTempo,
          };
        }),
      );
      if (entriesError) return;
      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    const { error: deleteBasicMenusError } = await supabase
      .from('practice_session_basic_menus')
      .delete()
      .eq('session_id', id);
    if (deleteBasicMenusError) return;
    const basicMenuRows = [
      ...(input.longToneMinutes != null
        ? [
            {
              session_id: id,
              menu_type: 'long_tone' as const,
              duration_minutes: input.longToneMinutes,
              tempo_bpms: null as number[] | null,
            },
          ]
        : []),
      ...(input.tonguingMinutes != null
        ? [
            {
              session_id: id,
              menu_type: 'tonguing' as const,
              duration_minutes: input.tonguingMinutes,
              tempo_bpms: input.tonguingTempoBpms?.length
                ? input.tonguingTempoBpms.map((e) => e.bpm)
                : null,
            },
          ]
        : []),
    ];
    if (basicMenuRows.length > 0) {
      const { error: basicError } = await supabase
        .from('practice_session_basic_menus')
        .insert(basicMenuRows);
      if (basicError) return;
    }

    const updatedSession: PracticeSession = {
      id,
      practicedAt: input.practicedAt,
      durationMinutes: totalDuration > 0 ? totalDuration : null,
      otherMinutes: input.otherMinutes ?? null,
      otherMemo: input.otherMemo || null,
      totalMinutes: totalMinutesValue,
      memo: input.memo || null,
      textbookEntries: input.textbookEntries.map((entry) => {
        const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
        const maxTempo = computeMaxTempo(entry.tempoBpms);
        return {
          textbookId: entry.textbookId,
          textbookTitle: tb?.title ?? '',
          currentPage: entry.currentPage,
          totalPages: tb?.totalPages ?? null,
          genre: tb?.genre ?? 'その他',
          durationMinutes: entry.durationMinutes ?? null,
          tempoBpm: maxTempo,
        };
      }),
      basicMenuEntries: basicMenuRows.map((r) => ({
        menuType: r.menu_type,
        durationMinutes: r.duration_minutes,
        tempoBpms: r.tempo_bpms ?? [],
      })),
    };
    if (tempRecordingUri) {
      try {
        await finalizeRecording(id);
      } catch {
        // 録音ファイルの保存に失敗しても練習記録の保存は継続する
      }
    }
    set({ sessions: get().sessions.map((s) => (s.id === id ? updatedSession : s)) });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    await deleteRecording(id);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
}));
