import { create } from 'zustand';

import { type PracticeLogInput } from '@/forms/practice-log';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
};

export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  memo: string | null;
  textbookEntries: TextbookEntry[];
};

type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    textbooks: { title: string; total_pages: number | null } | null;
  }[];
};

type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput) => Promise<void>;
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
        'id, practiced_at, duration_minutes, memo, practice_session_textbooks ( textbook_id, current_page, textbooks ( title, total_pages ) )',
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
        })),
      })),
    });
  },

  add: async (input: PracticeLogInput) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userData.user.id,
        practiced_at: input.practicedAt,
        duration_minutes: input.durationMinutes ?? null,
        memo: input.memo || null,
      })
      .select()
      .single();
    if (sessionError || !session) return;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          session_id: (session as { id: string }).id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
        })),
      );
      if (entriesError) return;

      for (const entry of input.textbookEntries) {
        await supabase.from('textbook_progress').upsert(
          {
            user_id: userData.user.id,
            textbook_id: entry.textbookId,
            current_page: entry.currentPage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,textbook_id' },
        );
      }
    }

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const newSession: PracticeSession = {
      id: (session as { id: string }).id,
      practicedAt: input.practicedAt,
      durationMinutes: input.durationMinutes ?? null,
      memo: input.memo || null,
      textbookEntries: input.textbookEntries.map((entry) => {
        const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
        return {
          textbookId: entry.textbookId,
          textbookTitle: tb?.title ?? '',
          currentPage: entry.currentPage,
          totalPages: tb?.totalPages ?? null,
        };
      }),
    };
    set({ sessions: [newSession, ...get().sessions] });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
}));
