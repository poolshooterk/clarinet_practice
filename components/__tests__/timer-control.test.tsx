import { fireEvent } from '@testing-library/react-native';

import { TimerControl } from '@/components/timer-control';
import { useTimerStore } from '@/store/timer';
import { renderWithProviders, screen } from '@/test-utils/render';

beforeEach(() => {
  useTimerStore.setState({ timers: {} });
});

describe('idle 状態', () => {
  it('計測開始・時刻で入力 ボタンを表示する', () => {
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストの計測開始')).toBeTruthy();
    expect(screen.getByLabelText('テストの時刻で入力')).toBeTruthy();
  });
});

describe('running 状態', () => {
  it('一時停止・停止 ボタンを表示する', () => {
    useTimerStore.setState({
      timers: { test: { status: 'running', accumulatedMs: 0, startedAt: Date.now() } },
    });
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストの一時停止')).toBeTruthy();
    expect(screen.getByLabelText('テストの停止')).toBeTruthy();
  });
});

describe('paused 状態', () => {
  it('再開・停止 ボタンを表示する', () => {
    useTimerStore.setState({
      timers: { test: { status: 'paused', accumulatedMs: 5000, startedAt: null } },
    });
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストの再開')).toBeTruthy();
    expect(screen.getByLabelText('テストの停止')).toBeTruthy();
  });
});

describe('stopped 状態', () => {
  it('計測結果テキストとリセットボタンを表示する', () => {
    useTimerStore.setState({
      timers: { test: { status: 'stopped', accumulatedMs: 61000, startedAt: null } },
    });
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストのリセット')).toBeTruthy();
    expect(screen.getByText('2分計測済')).toBeTruthy();
  });
});

describe('onStop コールバック', () => {
  it('停止ボタンを押すと onStop が分数で呼ばれる', () => {
    useTimerStore.setState({
      timers: { test: { status: 'paused', accumulatedMs: 61000, startedAt: null } },
    });
    const onStop = jest.fn();
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={onStop} />);
    fireEvent.press(screen.getByLabelText('テストの停止'));
    expect(onStop).toHaveBeenCalledWith(2);
  });
});

describe('手動時刻入力', () => {
  it('時刻で入力を押すと HH:MM フィールドが現れる', () => {
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    expect(screen.getByLabelText('テストの開始時刻')).toBeTruthy();
    expect(screen.getByLabelText('テストの終了時刻')).toBeTruthy();
  });

  it('10:00〜10:15 → onStop(15) が呼ばれる', () => {
    const onStop = jest.fn();
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={onStop} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    fireEvent.changeText(screen.getByLabelText('テストの開始時刻'), '10:00');
    fireEvent.changeText(screen.getByLabelText('テストの終了時刻'), '10:15');
    fireEvent.press(screen.getByLabelText('テストの適用'));
    expect(onStop).toHaveBeenCalledWith(15);
  });

  it('23:50〜00:10（日またぎ） → onStop(20) が呼ばれる', () => {
    const onStop = jest.fn();
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={onStop} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    fireEvent.changeText(screen.getByLabelText('テストの開始時刻'), '23:50');
    fireEvent.changeText(screen.getByLabelText('テストの終了時刻'), '00:10');
    fireEvent.press(screen.getByLabelText('テストの適用'));
    expect(onStop).toHaveBeenCalledWith(20);
  });

  it('同じ時刻ではエラーメッセージを表示する', () => {
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    fireEvent.changeText(screen.getByLabelText('テストの開始時刻'), '10:00');
    fireEvent.changeText(screen.getByLabelText('テストの終了時刻'), '10:00');
    fireEvent.press(screen.getByLabelText('テストの適用'));
    expect(screen.getByText('開始時刻と終了時刻が同じです')).toBeTruthy();
  });
});
