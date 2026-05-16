import { create } from 'zustand';

import { BASIC_GENRES, type PracticeLogInput } from '@/forms/practice-log';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  genre: string;
  durationMinutes: number | null;
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
  memo: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};

export function calcSessionTime(session: PracticeSession): { basic: number; textbook: number } {
  const basicTextbook = session.textbookEntries
    .filter((e) => (BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const textbookOnly = session.textbookEntries
    .filter((e) => !(BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  return {
    basic: (session.durationMinutes ?? 0) + basicTextbook,
    textbook: textbookOnly,
  };
}

type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    duration_minutes: number | null;
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
  add: (input: PracticeLogInput) => Promise<void>;
  update: (id: string, input: PracticeLogInput) => Promise<void>;
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
        'id, practiced_at, duration_minutes, memo, ' +
          'practice_session_textbooks ( textbook_id, current_page, duration_minutes, textbooks ( title, total_pages, genre ) ), ' +
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
        memo: row.memo ?? null,
        textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
          textbookId: entry.textbook_id,
          textbookTitle: entry.textbooks?.title ?? '',
          currentPage: entry.current_page,
          totalPages: entry.textbooks?.total_pages ?? null,
          genre: entry.textbooks?.genre ?? 'その他',
          durationMinutes: entry.duration_minutes ?? null,
        })),
        basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
          menuType: m.menu_type,
          durationMinutes: m.duration_minutes,
          tempoBpms: m.tempo_bpms ?? [],
        })),
      })),
    });
  },

  add: async (input: PracticeLogInput) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userData.user.id,
        practiced_at: input.practicedAt,
        duration_minutes: totalDuration > 0 ? totalDuration : null,
        memo: input.memo || null,
      })
      .select()
      .single();
    if (sessionError || !session) return;

    const sessionId = (session as { id: string }).id;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          session_id: sessionId,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
        })),
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

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const newSession: PracticeSession = {
      id: sessionId,
      practicedAt: input.practicedAt,
      durationMinutes: totalDuration > 0 ? totalDuration : null,
      memo: input.memo || null,
      textbookEntries: input.textbookEntries.map((entry) => {
        const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
        return {
          textbookId: entry.textbookId,
          textbookTitle: tb?.title ?? '',
          currentPage: entry.currentPage,
          totalPages: tb?.totalPages ?? null,
          genre: tb?.genre ?? 'その他',
          durationMinutes: entry.durationMinutes ?? null,
        };
      }),
      basicMenuEntries: basicMenuRows.map((r) => ({
        menuType: r.menu_type,
        durationMinutes: r.duration_minutes,
        tempoBpms: r.tempo_bpms ?? [],
      })),
    };
    set({ sessions: [newSession, ...get().sessions] });
  },

  update: async (id: string, input: PracticeLogInput) => {
    const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

    const { error: sessionError } = await supabase
      .from('practice_sessions')
      .update({
        practiced_at: input.practicedAt,
        duration_minutes: totalDuration > 0 ? totalDuration : null,
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
        input.textbookEntries.map((entry) => ({
          session_id: id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
        })),
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

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const updatedSession: PracticeSession = {
      id,
      practicedAt: input.practicedAt,
      durationMinutes: totalDuration > 0 ? totalDuration : null,
      memo: input.memo || null,
      textbookEntries: input.textbookEntries.map((entry) => {
        const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
        return {
          textbookId: entry.textbookId,
          textbookTitle: tb?.title ?? '',
          currentPage: entry.currentPage,
          totalPages: tb?.totalPages ?? null,
          genre: tb?.genre ?? 'その他',
          durationMinutes: entry.durationMinutes ?? null,
        };
      }),
      basicMenuEntries: basicMenuRows.map((r) => ({
        menuType: r.menu_type,
        durationMinutes: r.duration_minutes,
        tempoBpms: r.tempo_bpms ?? [],
      })),
    };
    set({ sessions: get().sessions.map((s) => (s.id === id ? updatedSession : s)) });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
}));
