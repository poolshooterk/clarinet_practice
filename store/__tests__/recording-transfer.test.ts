import { type LessonRecord, useLessonRecordStore } from '@/store/lesson-record';
import { type PracticeSession, usePracticeLogStore } from '@/store/practice-log';
import { buildMoveCandidates, moveRecording } from '@/store/recording-transfer';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn(),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: { getState: jest.fn().mockReturnValue({ textbooks: [] }) },
}));

jest.mock('@/store/textbook-progress', () => ({
  useTextbookProgressStore: {
    getState: jest.fn().mockReturnValue({ upsert: jest.fn().mockResolvedValue(undefined) }),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockRecording = () => jest.requireMock('@/lib/recording');

const seedSession = (recordings: PracticeSession['recordings']): PracticeSession => ({
  id: 'session-1',
  practicedAt: '2026-05-12',
  durationMinutes: null,
  otherMinutes: null,
  otherMemo: null,
  totalMinutes: null,
  memo: null,
  reedNumber: null,
  textbookEntries: [],
  basicMenuEntries: [],
  recordings,
});

const seedRecord = (recordings: LessonRecord['recordings']): LessonRecord => ({
  id: 'lr-1',
  heldAt: '2026-05-12T10:00:00',
  advice: null,
  notes: null,
  textbookEntries: [],
  recordings,
});

const insertChain = (id: string) => ({
  insert: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: { id } }),
    }),
  }),
});

const deleteChain = () => ({
  delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
});

describe('moveRecording', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    useLessonRecordStore.setState({ records: [], loading: false });
    jest.clearAllMocks();
  });

  it('練習→レッスン: 移動元から消え移動先に空き index で追加される', async () => {
    usePracticeLogStore.setState({
      sessions: [seedSession([{ id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: 'm' }])],
    });
    useLessonRecordStore.setState({ records: [seedRecord([])] });
    mockRecording().finalizeRecording.mockResolvedValueOnce('file:///lr-1-1.m4a');
    // 1st from: lesson 挿入 (移動先), 2nd from: practice 削除 (移動元)
    mockFrom().mockReturnValueOnce(insertChain('rec-new')).mockReturnValueOnce(deleteChain());

    const result = await moveRecording({
      sourceType: 'practice',
      sourceRecordId: 'session-1',
      recording: { id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: 'm' },
      targetType: 'lesson',
      targetRecordId: 'lr-1',
    });

    expect(result).toEqual({ ok: true });
    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('file:///s1-1.m4a', 'lr-1', 1);
    expect(usePracticeLogStore.getState().sessions[0].recordings).toHaveLength(0);
    const targetRecs = useLessonRecordStore.getState().records[0].recordings;
    expect(targetRecs).toEqual([
      { id: 'rec-new', index: 1, localUri: 'file:///lr-1-1.m4a', memo: 'm' },
    ]);
  });

  it('レッスン→練習: 移動先の空き index を使う', async () => {
    useLessonRecordStore.setState({
      records: [seedRecord([{ id: 'rec-9', index: 1, localUri: 'file:///lr1-1.m4a', memo: null }])],
    });
    usePracticeLogStore.setState({
      sessions: [
        seedSession([{ id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: null }]),
      ],
    });
    mockRecording().finalizeRecording.mockResolvedValueOnce('file:///session-1-2.m4a');
    mockFrom().mockReturnValueOnce(insertChain('rec-new')).mockReturnValueOnce(deleteChain());

    const result = await moveRecording({
      sourceType: 'lesson',
      sourceRecordId: 'lr-1',
      recording: { id: 'rec-9', index: 1, localUri: 'file:///lr1-1.m4a', memo: null },
      targetType: 'practice',
      targetRecordId: 'session-1',
    });

    expect(result).toEqual({ ok: true });
    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith(
      'file:///lr1-1.m4a',
      'session-1',
      2,
    );
    expect(useLessonRecordStore.getState().records[0].recordings).toHaveLength(0);
    expect(usePracticeLogStore.getState().sessions[0].recordings.map((r) => r.id)).toEqual([
      'rec-1',
      'rec-new',
    ]);
  });

  it('移動先が満杯なら ok:false を返し移動元は不変', async () => {
    usePracticeLogStore.setState({
      sessions: [
        seedSession([{ id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: null }]),
      ],
    });
    useLessonRecordStore.setState({
      records: [
        seedRecord([
          { id: 'a', index: 1, localUri: 'file:///lr1-1.m4a', memo: null },
          { id: 'b', index: 2, localUri: 'file:///lr1-2.m4a', memo: null },
          { id: 'c', index: 3, localUri: 'file:///lr1-3.m4a', memo: null },
        ]),
      ],
    });

    const result = await moveRecording({
      sourceType: 'practice',
      sourceRecordId: 'session-1',
      recording: { id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: null },
      targetType: 'lesson',
      targetRecordId: 'lr-1',
    });

    expect(result).toEqual({ ok: false });
    expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
    expect(mockFrom()).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions[0].recordings).toHaveLength(1);
  });
});

describe('buildMoveCandidates', () => {
  const oneRec = [{ id: 'r', index: 1 as const, localUri: 'file:///x.m4a', memo: null }];
  const threeRecs = [
    { id: 'a', index: 1 as const, localUri: 'file:///a.m4a', memo: null },
    { id: 'b', index: 2 as const, localUri: 'file:///b.m4a', memo: null },
    { id: 'c', index: 3 as const, localUri: 'file:///c.m4a', memo: null },
  ];

  const makeSession = (
    id: string,
    practicedAt: string,
    recordings: PracticeSession['recordings'],
  ): PracticeSession => ({
    ...seedSession(recordings),
    id,
    practicedAt,
  });
  const makeRecord = (
    id: string,
    heldAt: string,
    recordings: LessonRecord['recordings'],
  ): LessonRecord => ({
    ...seedRecord(recordings),
    id,
    heldAt,
  });

  it('自記録と満杯記録を除外し、日付の新しい順で返す', () => {
    const sessions = [
      makeSession('s1', '2026-05-10', oneRec), // 移動元 (自記録) → 除外
      makeSession('s2', '2026-05-20', threeRecs), // 満杯 → 除外
      makeSession('s3', '2026-05-25', []), // 候補
    ];
    const records = [makeRecord('lr1', '2026-05-15T10:00:00', [])]; // 候補

    const candidates = buildMoveCandidates(sessions, records, 'practice', 's1');

    expect(candidates.map((c) => ({ kind: c.kind, id: c.id }))).toEqual([
      { kind: 'practice', id: 's3' },
      { kind: 'lesson', id: 'lr1' },
    ]);
    expect(candidates[0].label).toContain('練習');
    expect(candidates[1].label).toContain('レッスン');
  });
});
