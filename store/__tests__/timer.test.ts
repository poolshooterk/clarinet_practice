import { useTimerStore } from '@/store/timer';

beforeEach(() => {
  useTimerStore.setState({ timers: {} });
});

describe('start', () => {
  it('idle → running になる', () => {
    useTimerStore.getState().start('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('running');
    expect(entry.startedAt).not.toBeNull();
    expect(entry.accumulatedMs).toBe(0);
  });

  it('paused → running になる（再開）', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 5000, startedAt: null } },
    });
    useTimerStore.getState().start('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('running');
    expect(entry.accumulatedMs).toBe(5000);
    expect(entry.startedAt).not.toBeNull();
  });
});

describe('pause', () => {
  it('running → paused になり経過時間を蓄積する', () => {
    const t0 = 1000000;
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(t0)
      .mockReturnValueOnce(t0 + 10000);
    useTimerStore.getState().start('long_tone');
    useTimerStore.getState().pause('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('paused');
    expect(entry.accumulatedMs).toBe(10000);
    expect(entry.startedAt).toBeNull();
    jest.restoreAllMocks();
  });

  it('idle 状態への pause は何もしない', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'idle', accumulatedMs: 0, startedAt: null } },
    });
    useTimerStore.getState().pause('long_tone');
    expect(useTimerStore.getState().timers['long_tone'].status).toBe('idle');
  });
});

describe('stop', () => {
  it('1 秒以下 → 1 分（最小値）', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 500, startedAt: null } },
    });
    const minutes = useTimerStore.getState().stop('long_tone');
    expect(minutes).toBe(1);
    expect(useTimerStore.getState().timers['long_tone'].status).toBe('stopped');
  });

  it('ちょうど 60 秒 → 1 分', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 60000, startedAt: null } },
    });
    expect(useTimerStore.getState().stop('long_tone')).toBe(1);
  });

  it('61 秒 → 2 分（切り上げ）', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 61000, startedAt: null } },
    });
    expect(useTimerStore.getState().stop('long_tone')).toBe(2);
  });

  it('running 中でも残り時間を加算して計算する', () => {
    const t0 = 1000000;
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(t0)
      .mockReturnValueOnce(t0 + 90000);
    useTimerStore.getState().start('tonguing');
    const minutes = useTimerStore.getState().stop('tonguing');
    expect(minutes).toBe(2);
    jest.restoreAllMocks();
  });

  it('未登録キーを stop しても 1 を返す', () => {
    expect(useTimerStore.getState().stop('unknown')).toBe(1);
  });
});

describe('reset', () => {
  it('stopped → idle に戻り accumulatedMs が 0 になる', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'stopped', accumulatedMs: 60000, startedAt: null } },
    });
    useTimerStore.getState().reset('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('idle');
    expect(entry.accumulatedMs).toBe(0);
    expect(entry.startedAt).toBeNull();
  });
});

describe('resetAll', () => {
  it('全タイマーをクリアする', () => {
    useTimerStore.getState().start('long_tone');
    useTimerStore.getState().start('tonguing');
    useTimerStore.getState().resetAll();
    expect(useTimerStore.getState().timers).toEqual({});
  });
});
