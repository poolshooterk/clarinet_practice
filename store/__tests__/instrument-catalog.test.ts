import AsyncStorage from '@react-native-async-storage/async-storage';

import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

jest.mock('@/lib/supabase', () => {
  const makersData = [
    { id: 'maker-1', name: 'Buffet Crampon' },
    { id: 'maker-2', name: 'Yamaha' },
  ];
  const modelsData = [
    { id: 'model-1', maker_id: 'maker-1', name: 'R13' },
    { id: 'model-2', maker_id: 'maker-1', name: 'E11' },
    { id: 'model-3', maker_id: 'maker-2', name: 'YCL-650' },
  ];
  const newMaker = { id: 'maker-new', name: 'Selmer' };
  const newModel = { id: 'model-new', maker_id: 'maker-1', name: 'Tosca' };

  // fetchAll は select().order() チェーン、addMaker/addModel は insert().select().single() チェーン。
  // 各テーブルオブジェクトがどちらの呼び出し順にも対応できるよう、
  // select の戻り値に single を持たせる。
  const makeSingleResult = (data: unknown) => ({
    single: jest.fn().mockResolvedValue({ data, error: null }),
  });

  return {
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'instrument_makers') {
          return {
            select: jest.fn().mockImplementation(() => ({
              order: jest.fn().mockResolvedValue({ data: makersData, error: null }),
              ...makeSingleResult(newMaker),
            })),
            insert: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: makersData, error: null }),
          };
        }
        if (table === 'instrument_models') {
          return {
            select: jest.fn().mockImplementation(() => ({
              order: jest.fn().mockResolvedValue({ data: modelsData, error: null }),
              ...makeSingleResult(newModel),
            })),
            insert: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: modelsData, error: null }),
          };
        }
        return {};
      }),
    },
  };
});

describe('useInstrumentCatalogStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useInstrumentCatalogStore.setState({ makers: [], models: [], loading: false });
  });

  it('初期状態: makers / models は空配列', () => {
    const { makers, models } = useInstrumentCatalogStore.getState();
    expect(makers).toEqual([]);
    expect(models).toEqual([]);
  });

  it('fetchAll でメーカーと機種名がセットされる', async () => {
    await useInstrumentCatalogStore.getState().fetchAll();
    const { makers, models } = useInstrumentCatalogStore.getState();
    expect(makers).toHaveLength(2);
    expect(makers[0]).toEqual({ id: 'maker-1', name: 'Buffet Crampon' });
    expect(models).toHaveLength(3);
  });

  it('addMaker で makers に追加される', async () => {
    await useInstrumentCatalogStore.getState().addMaker('Selmer');
    const { makers } = useInstrumentCatalogStore.getState();
    expect(makers.some((m) => m.name === 'Selmer')).toBe(true);
  });

  it('addModel で models に追加され、maker_id が makerId にキャメルケース変換される', async () => {
    await useInstrumentCatalogStore.getState().addModel('maker-1', 'Tosca');
    const models = useInstrumentCatalogStore.getState().models;
    const added = models.find((m) => m.name === 'Tosca');
    expect(added).toBeDefined();
    expect(added?.makerId).toBe('maker-1');
  });

  it('fetchAll が Supabase エラーを返してもキャッシュがあれば維持される', async () => {
    useInstrumentCatalogStore.setState({
      makers: [{ id: 'cached-1', name: 'Cached Maker' }],
      models: [],
      loading: false,
    });
    const { supabase } = jest.requireMock('@/lib/supabase');
    supabase.from.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: new Error('network error') }),
    }));

    await useInstrumentCatalogStore.getState().fetchAll();

    expect(useInstrumentCatalogStore.getState().makers).toEqual([
      { id: 'cached-1', name: 'Cached Maker' },
    ]);
  });
});
