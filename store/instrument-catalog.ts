import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { supabase } from '@/lib/supabase';

type Maker = { id: string; name: string };
type Model = { id: string; makerId: string; name: string };

type InstrumentCatalogState = {
  makers: Maker[];
  models: Model[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  addMaker: (name: string) => Promise<void>;
  addModel: (makerId: string, name: string) => Promise<void>;
};

export const useInstrumentCatalogStore = create<InstrumentCatalogState>()(
  persist(
    (set, get) => ({
      makers: [],
      models: [],
      loading: false,

      fetchAll: async () => {
        set({ loading: true });
        const [makersRes, modelsRes] = await Promise.all([
          supabase.from('instrument_makers').select('id, name').order('name'),
          supabase.from('instrument_models').select('id, maker_id, name').order('name'),
        ]);
        set({ loading: false });

        if (makersRes.error || modelsRes.error) return;

        set({
          makers: makersRes.data ?? [],
          models: (modelsRes.data ?? []).map((m) => ({
            id: m.id,
            makerId: m.maker_id,
            name: m.name,
          })),
        });
      },

      addMaker: async (name: string) => {
        const { data, error } = await supabase
          .from('instrument_makers')
          .insert({ name })
          .select()
          .single();
        if (error || !data) return;
        set({ makers: [...get().makers, { id: data.id, name: data.name }] });
      },

      addModel: async (makerId: string, name: string) => {
        const { data, error } = await supabase
          .from('instrument_models')
          .insert({ maker_id: makerId, name })
          .select()
          .single();
        if (error || !data) return;
        set({
          models: [...get().models, { id: data.id, makerId: data.maker_id, name: data.name }],
        });
      },
    }),
    {
      name: 'clarinet-practice-instrument-catalog',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ makers: s.makers, models: s.models }),
    },
  ),
);
