import { create } from 'zustand';

import type { ClarinetEquipment } from '@/forms/equipment';
import { supabase } from '@/lib/supabase';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

type UserEquipmentRow = {
  instrument_maker_id: string | null;
  instrument_model_id: string | null;
  instrument_purchase_price: number | null;
  instrument_start_date: string | null;
  instrument_photo_uri: string | null;
  reed_name: string | null;
  reed_start_date: string | null;
  ligature_name: string | null;
  ligature_start_date: string | null;
  mouthpiece_name: string | null;
  mouthpiece_start_date: string | null;
};

type EquipmentState = {
  equipment: ClarinetEquipment | null;
  loaded: boolean;
  loading: boolean;
  fetchEquipment: () => Promise<void>;
  saveEquipment: (e: ClarinetEquipment) => Promise<{ ok: true } | { ok: false }>;
};

function rowToEquipment(row: UserEquipmentRow): ClarinetEquipment | null {
  const { makers, models } = useInstrumentCatalogStore.getState();
  const makerId = row.instrument_maker_id ?? '';
  const modelId = row.instrument_model_id ?? '';
  const makerName = makers.find((m) => m.id === makerId)?.name ?? '';
  const modelName = models.find((m) => m.id === modelId)?.name ?? '';

  // 必須項目が空なら未登録扱い (= null) として、フォームは空デフォルトで描画する
  if (!makerId || !modelId || !row.instrument_start_date) return null;

  return {
    instrument: {
      makerId,
      makerName,
      modelId,
      modelName,
      purchasePrice: row.instrument_purchase_price ?? undefined,
      startDate: row.instrument_start_date,
      photoUri: row.instrument_photo_uri ?? undefined,
    },
    reed: {
      name: row.reed_name ?? '',
      startDate: row.reed_start_date ?? '',
    },
    ligature: {
      name: row.ligature_name ?? '',
      startDate: row.ligature_start_date ?? '',
    },
    mouthpiece: {
      name: row.mouthpiece_name ?? '',
      startDate: row.mouthpiece_start_date ?? '',
    },
  };
}

export const useEquipmentStore = create<EquipmentState>()((set) => ({
  equipment: null,
  loaded: false,
  loading: false,

  fetchEquipment: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      set({ loaded: true });
      return;
    }

    // 名前解決のためカタログを最新化してから読み出す
    await useInstrumentCatalogStore.getState().fetchAll();

    set({ loading: true });
    const { data, error } = await supabase
      .from('user_equipment')
      .select(
        'instrument_maker_id, instrument_model_id, instrument_purchase_price, ' +
          'instrument_start_date, instrument_photo_uri, ' +
          'reed_name, reed_start_date, ligature_name, ligature_start_date, ' +
          'mouthpiece_name, mouthpiece_start_date',
      )
      .eq('user_id', userData.user.id)
      .maybeSingle();
    set({ loading: false, loaded: true });

    if (error || !data) return;

    set({ equipment: rowToEquipment(data as unknown as UserEquipmentRow) });
  },

  saveEquipment: async (e: ClarinetEquipment) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { ok: false };

    const { error } = await supabase.from('user_equipment').upsert({
      user_id: userData.user.id,
      instrument_maker_id: e.instrument.makerId,
      instrument_model_id: e.instrument.modelId,
      instrument_purchase_price: e.instrument.purchasePrice ?? null,
      instrument_start_date: e.instrument.startDate,
      instrument_photo_uri: e.instrument.photoUri ?? null,
      reed_name: e.reed.name,
      reed_start_date: e.reed.startDate,
      ligature_name: e.ligature.name,
      ligature_start_date: e.ligature.startDate,
      mouthpiece_name: e.mouthpiece.name,
      mouthpiece_start_date: e.mouthpiece.startDate,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false };

    set({ equipment: e, loaded: true });
    return { ok: true };
  },
}));
