import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTextbookCatalogStore } from '@/store/textbook-catalog';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;

const rows = [
  { id: 'tb-1', title: 'ローズ 32のエチュード', publisher: '全音楽譜出版社', difficulty: '中級' },
  { id: 'tb-2', title: 'クローゼ 教則本', publisher: null, difficulty: '上級' },
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
    });
  });

  it('fetchAll がエラーを返してもキャッシュが維持される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: rows.map((r) => ({
        ...r,
        publisher: r.publisher ?? null,
        difficulty: r.difficulty as '中級' | '上級',
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
            data: { id: 'tb-new', title: '新しい教本', publisher: null, difficulty: null },
            error: null,
          }),
        }),
      }),
    });
    await useTextbookCatalogStore.getState().add({ title: '新しい教本' });
    const { textbooks } = useTextbookCatalogStore.getState();
    expect(textbooks.some((t) => t.title === '新しい教本')).toBe(true);
  });

  it('update で該当教本のタイトルが更新される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [{ id: 'tb-1', title: '旧タイトル', publisher: null, difficulty: null }],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTextbookCatalogStore.getState().update('tb-1', { title: '新タイトル' });
    const t = useTextbookCatalogStore.getState().textbooks.find((x) => x.id === 'tb-1');
    expect(t?.title).toBe('新タイトル');
  });

  it('remove で該当教本が削除される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [{ id: 'tb-1', title: 'ローズ', publisher: null, difficulty: null }],
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
