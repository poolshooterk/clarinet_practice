import { fireEvent } from '@testing-library/react-native';

import { SessionTimer } from '@/components/form/session-timer';
import { useTimerStore } from '@/store/timer';
import { renderWithProviders } from '@/test-utils/render';

describe('SessionTimer', () => {
  beforeEach(() => {
    useTimerStore.setState({ timers: {} });
    jest.restoreAllMocks();
  });

  it('練習開始で開始時刻が onTimesChange に渡る', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 0, 1, 19, 0, 0).getTime());
    const onTimesChange = jest.fn();
    const { getByLabelText } = renderWithProviders(<SessionTimer onTimesChange={onTimesChange} />);
    fireEvent.press(getByLabelText('練習の計測開始'));
    expect(onTimesChange).toHaveBeenCalledWith({ startTime: '19:00', endTime: null });
  });

  it('停止で終了時刻 = 開始 + 計測 が渡る', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 0, 1, 19, 0, 0).getTime());
    const onTimesChange = jest.fn();
    const { getByLabelText } = renderWithProviders(<SessionTimer onTimesChange={onTimesChange} />);
    fireEvent.press(getByLabelText('練習の計測開始'));
    now.mockReturnValue(new Date(2026, 0, 1, 19, 50, 0).getTime()); // +50分
    fireEvent.press(getByLabelText('練習の停止'));
    expect(onTimesChange).toHaveBeenLastCalledWith({ startTime: '19:00', endTime: '19:50' });
  });

  describe('onFirstStart', () => {
    it('初回の練習開始で 1 回だけ呼ばれる', () => {
      const onFirstStart = jest.fn();
      const { getByLabelText } = renderWithProviders(
        <SessionTimer onTimesChange={jest.fn()} onFirstStart={onFirstStart} />,
      );
      fireEvent.press(getByLabelText('練習の計測開始'));
      expect(onFirstStart).toHaveBeenCalledTimes(1);
    });

    it('一時停止からの再開では呼ばれない', () => {
      const onFirstStart = jest.fn();
      const { getByLabelText } = renderWithProviders(
        <SessionTimer onTimesChange={jest.fn()} onFirstStart={onFirstStart} />,
      );
      fireEvent.press(getByLabelText('練習の計測開始'));
      fireEvent.press(getByLabelText('練習の一時停止'));
      fireEvent.press(getByLabelText('練習の再開'));
      expect(onFirstStart).toHaveBeenCalledTimes(1);
    });

    it('リセット後に再度開始すると改めて呼ばれる', () => {
      const onFirstStart = jest.fn();
      const { getByLabelText } = renderWithProviders(
        <SessionTimer onTimesChange={jest.fn()} onFirstStart={onFirstStart} />,
      );
      fireEvent.press(getByLabelText('練習の計測開始'));
      fireEvent.press(getByLabelText('練習の停止'));
      fireEvent.press(getByLabelText('練習タイマーのリセット'));
      fireEvent.press(getByLabelText('練習の計測開始'));
      expect(onFirstStart).toHaveBeenCalledTimes(2);
    });

    it('未指定でも練習開始で例外にならない', () => {
      const { getByLabelText } = renderWithProviders(<SessionTimer onTimesChange={jest.fn()} />);
      expect(() => fireEvent.press(getByLabelText('練習の計測開始'))).not.toThrow();
    });
  });
});
