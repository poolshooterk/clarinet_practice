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
});
