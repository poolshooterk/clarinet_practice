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

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;
const mockRecording = () => jest.requireMock('@/lib/recording');

describe('useLessonRecordStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({ records: [], loading: false });
    jest.clearAllMocks();
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('初期状態: records は空配列', () => {
    expect(useLessonRecordStore.getState().records).toEqual([]);
  });

  it('fetchAll で records がセットされる', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lr-1',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: 'タンギングを軽く',
              notes: null,
            },
            {
              id: 'lr-2',
              held_at: '2026-04-20T06:00:00.000Z',
              advice: null,
              notes: '息のスピードが足りない',
            },
          ],
          error: null,
        }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      id: 'lr-1',
      heldAt: '2026-05-15T05:00:00.000Z',
      advice: 'タンギングを軽く',
      notes: null,
    });
    expect(records[1].notes).toBe('息のスピードが足りない');
  });

  it('fetchAll がエラーを返しても既存の records が維持される', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
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
              held_at: '2026-05-15T05:00:00.000Z',
              advice: 'アドバイス',
              notes: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add({ date: '2026-05-15', time: '14:00', advice: 'アドバイス', notes: '' });
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('lr-new');
    expect(records[0].advice).toBe('アドバイス');
    expect(records[0].notes).toBeNull();
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
      .add({ date: '2026-05-15', time: '14:00', advice: '', notes: '' });
    expect(useLessonRecordStore.getState().records).toHaveLength(0);
  });

  it('update で対象 record の内容が更新される', async () => {
    useLessonRecordStore.setState({
      records: [
        { id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: '古いアドバイス', notes: null },
      ],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '新しいアドバイス',
      notes: 'メモ',
    });
    const { records } = useLessonRecordStore.getState();
    expect(records[0].advice).toBe('新しいアドバイス');
    expect(records[0].notes).toBe('メモ');
    expect(records[0].heldAt).toBe('2026-05-20T10:00:00+09:00');
  });

  it('update がエラーを返すと records は変わらない', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: '元', notes: null }],
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
    });
    expect(useLessonRecordStore.getState().records[0].advice).toBe('元');
  });

  it('remove で対象 record が削除される', async () => {
    useLessonRecordStore.setState({
      records: [
        { id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null },
        { id: 'lr-2', heldAt: '2026-04-20T06:00:00.000Z', advice: null, notes: null },
      ],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('lr-2');
  });

  it('remove がエラーを返すと records は変わらない', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('delete error') }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
  });

  it('add: tempRecordingUri あり → finalizeRecording がレコードIDで呼ばれる', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T05:00:00.000Z', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add(
        { date: '2026-05-15', time: '14:00', advice: '', notes: '' },
        'file:///data/recordings/tmp.m4a',
      );
    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('lr-new');
  });

  it('add: tempRecordingUri なし → finalizeRecording は呼ばれない', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T05:00:00.000Z', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add({ date: '2026-05-15', time: '14:00', advice: '', notes: '' });
    expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
  });

  it('update: tempRecordingUri あり → finalizeRecording がレコードIDで呼ばれる', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .update(
        'lr-1',
        { date: '2026-05-20', time: '10:00', advice: '', notes: '' },
        'file:///data/recordings/tmp.m4a',
      );
    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('lr-1');
  });

  it('update: tempRecordingUri なし → finalizeRecording は呼ばれない', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .update('lr-1', { date: '2026-05-20', time: '10:00', advice: '', notes: '' });
    expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
  });

  it('remove: deleteRecording がレコードIDで呼ばれる', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(mockRecording().deleteRecording).toHaveBeenCalledWith('lr-1');
  });

  it('add: finalizeRecording が失敗しても record は保存される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T05:00:00.000Z', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    mockRecording().finalizeRecording.mockRejectedValueOnce(new Error('disk full'));
    await useLessonRecordStore
      .getState()
      .add(
        { date: '2026-05-15', time: '14:00', advice: '', notes: '' },
        'file:///data/recordings/tmp.m4a',
      );
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
    expect(useLessonRecordStore.getState().records[0].id).toBe('lr-new');
  });
});
