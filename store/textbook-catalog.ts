import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Difficulty, type Genre, type TextbookInput } from '@/forms/textbook';
import { supabase } from '@/lib/supabase';

export type Textbook = {
  id: string;
  title: string;
  publisher: string | null;
  genre: Genre;
  difficulty: Difficulty | null;
  totalPages: number | null;
};

type TextbookCatalogState = {
  textbooks: Textbook[];
  /** fetchAll ローディング専用。ミューテーション (add/update/remove) はローディング管理しない */
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: TextbookInput) => Promise<void>;
  update: (id: string, input: TextbookInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useTextbookCatalogStore = create<TextbookCatalogState>()(
  persist(
    (set, get) => ({
      textbooks: [],
      loading: false,

      fetchAll: async () => {
        set({ loading: true });
        const { data, error } = await supabase.from('textbooks').select('*').order('title');
        set({ loading: false });
        if (error || !data) return;
        set({
          textbooks: data.map((row) => ({
            id: row.id,
            title: row.title,
            publisher: row.publisher ?? null,
            genre: row.genre as Genre,
            difficulty: (row.difficulty as Difficulty) ?? null,
            totalPages: (row.total_pages as number) ?? null,
          })),
        });
      },

      add: async (input: TextbookInput) => {
        const { data, error } = await supabase
          .from('textbooks')
          .insert({
            title: input.title,
            publisher: input.publisher || null,
            genre: input.genre,
            difficulty: input.difficulty ?? null,
            total_pages: input.totalPages ?? null,
          })
          .select()
          .single();
        if (error || !data) return;
        set({
          textbooks: [
            ...get().textbooks,
            {
              id: data.id,
              title: data.title,
              publisher: data.publisher ?? null,
              genre: data.genre as Genre,
              difficulty: (data.difficulty as Difficulty) ?? null,
              totalPages: (data.total_pages as number) ?? null,
            },
          ],
        });
      },

      update: async (id: string, input: TextbookInput) => {
        const { error } = await supabase
          .from('textbooks')
          .update({
            title: input.title,
            publisher: input.publisher || null,
            genre: input.genre,
            difficulty: input.difficulty ?? null,
            total_pages: input.totalPages ?? null,
          })
          .eq('id', id);
        if (error) return;
        set({
          textbooks: get().textbooks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  title: input.title,
                  publisher: input.publisher || null,
                  genre: input.genre,
                  difficulty: input.difficulty ?? null,
                  totalPages: input.totalPages ?? null,
                }
              : t,
          ),
        });
      },

      remove: async (id: string) => {
        const { error } = await supabase.from('textbooks').delete().eq('id', id);
        if (error) return;
        set({ textbooks: get().textbooks.filter((t) => t.id !== id) });
      },
    }),
    {
      name: 'clarinet-practice-textbook-catalog',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ textbooks: s.textbooks }),
    },
  ),
);
