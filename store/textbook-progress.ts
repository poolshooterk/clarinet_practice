import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type TextbookProgressState = {
  progress: Record<string, number>;
  fetchAll: () => Promise<void>;
  upsert: (textbookId: string, currentPage: number) => Promise<void>;
};

export const useTextbookProgressStore = create<TextbookProgressState>()((set) => ({
  progress: {},

  fetchAll: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    const { data: rows, error } = await supabase
      .from('textbook_progress')
      .select('textbook_id, current_page')
      .eq('user_id', data.user.id);
    if (error || !rows) return;
    const progressMap: Record<string, number> = {};
    for (const row of rows) {
      progressMap[row.textbook_id as string] = row.current_page as number;
    }
    set({ progress: progressMap });
  },

  upsert: async (textbookId: string, currentPage: number) => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    const { error } = await supabase.from('textbook_progress').upsert(
      {
        user_id: data.user.id,
        textbook_id: textbookId,
        current_page: currentPage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,textbook_id' },
    );
    if (error) return;
    set((state) => ({
      progress: { ...state.progress, [textbookId]: currentPage },
    }));
  },
}));
