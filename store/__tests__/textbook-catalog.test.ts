import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTextbookCatalogStore } from '@/store/textbook-catalog';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;

const rows = [
  {
    id: 'tb-1',
    title: 'ローズ 32のエチュード',
    publisher: '全音楽譜出版社',
    difficulty: '中級',
    total_pages: 32,
  },
  { id: 'tb-2', title: 'クローゼ 教則本', publisher: null, difficulty: '上級', total_pages: null },
];

describe('useTextbookCatalogStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTextbookCatalogStore.setState({ textbooks: [], loading: false });
  });

  it('初期状態: textbooks は空配列', () => {
    expect(useTextbookCatalogStore.getState().textbooks).toEqual([]);
  });

  it('fetchAll で textbooks がセットされる', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    });
    await useTextbookCatalogStore.getState().fetchAll();
    const { textbooks } = useTextbookCatalogStore.getState();
    expect(textbooks).toHaveLength(2);
    expect(textbooks[0]).toEqual({
      id: 'tb-1',
      title: 'ローズ 32のエチュード',
      publisher: '全音楽譜出版社',
      difficulty: '中級',
      totalPages: 32,
    });
    expect(textbooks[1].totalPages).toBeNull();
  });

  it('fetchAll がエラーを返してもキャッシュが維持される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: rows.map((r) => ({
        id: r.id,
        title: r.title,
        publisher: r.publisher ?? null,
        difficulty: r.difficulty as '中級' | '上級',
        totalPages: r.total_pages ?? null,
      })),
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('network') }),
      }),
    });
    await useTextbookCatalogStore.getState().fetchAll();
    expect(useTextbookCatalogStore.getState().textbooks).toHaveLength(2);
  });

  it('add で textbooks に追加される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'tb-new',
              title: '新しい教本',
              publisher: null,
              difficulty: null,
              total_pages: 80,
            },
            error: null,
          }),
        }),
      }),
    });
    await useTextbookCatalogStore
      .getState()
      .add({ title: '新しい教本', genre: 'エチュード', totalPages: 80 });
    const { textbooks } = useTextbookCatalogStore.getState();
    const added = textbooks.find((t) => t.title === '新しい教本');
    expect(added).toBeDefined();
    expect(added?.totalPages).toBe(80);
  });

  it('update で該当教本の totalPages が更新される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        { id: 'tb-1', title: '旧タイトル', publisher: null, difficulty: null, totalPages: null },
      ],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTextbookCatalogStore
      .getState()
      .update('tb-1', { title: '新タイトル', genre: 'エチュード', totalPages: 60 });
    const t = useTextbookCatalogStore.getState().textbooks.find((x) => x.id === 'tb-1');
    expect(t?.title).toBe('新タイトル');
    expect(t?.totalPages).toBe(60);
  });

  it('remove で該当教本が削除される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        { id: 'tb-1', title: 'ローズ', publisher: null, difficulty: null, totalPages: null },
      ],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTextbookCatalogStore.getState().remove('tb-1');
    expect(useTextbookCatalogStore.getState().textbooks).toHaveLength(0);
  });
});
