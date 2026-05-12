import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Difficulty, type TextbookInput } from '@/forms/textbook';
import { supabase } from '@/lib/supabase';

export type Textbook = {
  id: string;
  title: string;
  publisher: string | null;
  difficulty: Difficulty | null;
};

type TextbookCatalogState = {
  textbooks: Textbook[];
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
            difficulty: (row.difficulty as Difficulty) ?? null,
          })),
        });
      },

      add: async (input: TextbookInput) => {
        const { data, error } = await supabase
          .from('textbooks')
          .insert({
            title: input.title,
            publisher: input.publisher || null,
            difficulty: input.difficulty ?? null,
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
              difficulty: (data.difficulty as Difficulty) ?? null,
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
            difficulty: input.difficulty ?? null,
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
                  difficulty: input.difficulty ?? null,
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
