import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLessonRecordStore } from '@/store/lesson-record';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: {
    getState: jest.fn().mockReturnValue({ textbooks: [] }),
  },
}));

jest.mock('@/store/textbook-progress', () => ({
  useTextbookProgressStore: {
    getState: jest.fn().mockReturnValue({ upsert: jest.fn().mockResolvedValue(undefined) }),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;
const mockRecording = () => jest.requireMock('@/lib/recording');
const mockCatalog = () => jest.requireMock('@/store/textbook-catalog').useTextbookCatalogStore;
const mockProgress = () => jest.requireMock('@/store/textbook-progress').useTextbookProgressStore;

describe('useLessonRecordStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({ records: [], loading: false });
    jest.clearAllMocks();
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockCatalog().getState.mockReturnValue({ textbooks: [] });
    mockProgress().getState.mockReturnValue({ upsert: jest.fn().mockResolvedValue(undefined) });
  });

  it('初期状態: records は空配列', () => {
    expect(useLessonRecordStore.getState().records).toEqual([]);
  });

  it('fetchAll で records がセットされる（textbookEntries を含む）', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lr-1',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: 'タンギングを軽く',
              notes: null,
              lesson_record_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 12,
                  duration_minutes: 20,
                  tempo_bpm: 100,
                  textbooks: { title: 'ローズ 32のエチュード' },
                },
              ],
            },
          ],
          error: null,
        }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].advice).toBe('タンギングを軽く');
    expect(records[0].textbookEntries).toHaveLength(1);
    expect(records[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 12,
      durationMinutes: 20,
      tempoBpm: 100,
    });
  });

  it('fetchAll で textbookEntries がない場合は空配列', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lr-1',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: null,
              notes: null,
              lesson_record_textbooks: [],
            },
          ],
          error: null,
        }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    expect(useLessonRecordStore.getState().records[0].textbookEntries).toEqual([]);
  });

  it('fetchAll がエラーを返しても既存の records が維持される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('network') }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
  });

  it('add で records の先頭に追加される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'lr-new',
              held_at: '2026-05-15T14:00:00+09:00',
              advice: 'アドバイス',
              notes: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore.getState().add({
      date: '2026-05-15',
      time: '14:00',
      advice: 'アドバイス',
      notes: '',
      textbookEntries: [],
    });
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('lr-new');
    expect(records[0].advice).toBe('アドバイス');
    expect(records[0].textbookEntries).toEqual([]);
  });

  it('add: textbookEntries あり → lesson_record_textbooks に INSERT される', async () => {
    mockCatalog().getState.mockReturnValue({
      textbooks: [{ id: 'tb-1', title: 'ローズ 32のエチュード' }],
    });
    // 1st from(): lesson_records insert
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    // 2nd from(): lesson_record_textbooks insert
    const mockTextbookInsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom().mockReturnValueOnce({ insert: mockTextbookInsert });

    await useLessonRecordStore.getState().add({
      date: '2026-05-15',
      time: '14:00',
      advice: '',
      notes: '',
      textbookEntries: [
        { textbookId: 'tb-1', currentPage: 10, durationMinutes: 15, tempoBpm: 100 },
      ],
    });

    expect(mockTextbookInsert).toHaveBeenCalledWith([
      {
        lesson_record_id: 'lr-new',
        textbook_id: 'tb-1',
        current_page: 10,
        duration_minutes: 15,
        tempo_bpm: 100,
      },
    ]);
    const { records } = useLessonRecordStore.getState();
    expect(records[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 10,
    });
  });

  it('add: textbookEntries あり → useTextbookProgressStore.upsert が呼ばれる', async () => {
    const mockUpsert = jest.fn().mockResolvedValue(undefined);
    mockProgress().getState.mockReturnValue({ upsert: mockUpsert });
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    mockFrom().mockReturnValueOnce({ insert: jest.fn().mockResolvedValue({ error: null }) });

    await useLessonRecordStore.getState().add({
      date: '2026-05-15',
      time: '14:00',
      advice: '',
      notes: '',
      textbookEntries: [{ textbookId: 'tb-1', currentPage: 10 }],
    });

    expect(mockUpsert).toHaveBeenCalledWith('tb-1', 10);
  });

  it('add がエラーを返すと records は変わらない', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('insert error') }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add({ date: '2026-05-15', time: '14:00', advice: '', notes: '', textbookEntries: [] });
    expect(useLessonRecordStore.getState().records).toHaveLength(0);
  });

  it('update で対象 record の内容が更新される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: '古いアドバイス',
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    // 1st from(): lesson_records update
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    // 2nd from(): lesson_record_textbooks delete
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '新しいアドバイス',
      notes: 'メモ',
      textbookEntries: [],
    });
    const { records } = useLessonRecordStore.getState();
    expect(records[0].advice).toBe('新しいアドバイス');
    expect(records[0].notes).toBe('メモ');
  });

  it('update: textbookEntries あり → delete 後に INSERT される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const mockTextbookInsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom().mockReturnValueOnce({ insert: mockTextbookInsert });

    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '',
      notes: '',
      textbookEntries: [{ textbookId: 'tb-2', currentPage: 5 }],
    });

    expect(mockTextbookInsert).toHaveBeenCalledWith([
      {
        lesson_record_id: 'lr-1',
        textbook_id: 'tb-2',
        current_page: 5,
        duration_minutes: null,
        tempo_bpm: null,
      },
    ]);
  });

  it('update がエラーを返すと records は変わらない', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: '元',
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('update error') }),
      }),
    });
    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '変更後',
      notes: '',
      textbookEntries: [],
    });
    expect(useLessonRecordStore.getState().records[0].advice).toBe('元');
  });

  it('remove で対象 record が削除される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
        {
          id: 'lr-2',
          heldAt: '2026-04-20T06:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
    expect(useLessonRecordStore.getState().records[0].id).toBe('lr-2');
  });

  it('add: tempRecordingUri あり → finalizeRecording がレコードIDで呼ばれる', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add(
        { date: '2026-05-15', time: '14:00', advice: '', notes: '', textbookEntries: [] },
        'file:///data/recordings/tmp.m4a',
      );
    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('lr-new');
  });

  it('add: finalizeRecording が失敗しても record は保存される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    mockRecording().finalizeRecording.mockRejectedValueOnce(new Error('disk full'));
    await useLessonRecordStore
      .getState()
      .add(
        { date: '2026-05-15', time: '14:00', advice: '', notes: '', textbookEntries: [] },
        'file:///data/recordings/tmp.m4a',
      );
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
  });

  it('remove: deleteRecording がレコードIDで呼ばれる', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(mockRecording().deleteRecording).toHaveBeenCalledWith('lr-1');
  });
});
