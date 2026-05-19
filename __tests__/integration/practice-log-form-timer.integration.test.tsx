import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { PracticeLogForm } from '@/components/practice-log-form';
import { useTimerStore } from '@/store/timer';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  createSound: jest.fn(),
}));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: jest.fn((selector: (s: { textbooks: never[] }) => unknown) =>
    selector({ textbooks: [] }),
  ),
}));

jest.mock('@/store/practice-log', () => ({
  usePracticeLogStore: jest.fn((selector: (s: { sessions: never[] }) => unknown) =>
    selector({ sessions: [] }),
  ),
}));

beforeEach(() => {
  useTimerStore.setState({ timers: {} });
});

it('計測開始 → 停止 でロングトーン分数フィールドが更新される', async () => {
  const t0 = 1_000_000;
  jest
    .spyOn(Date, 'now')
    .mockReturnValueOnce(t0)
    .mockReturnValueOnce(t0 + 90_000);

  const ref = React.createRef<import('@/components/practice-log-form').PracticeLogFormRef>();
  renderWithProviders(<PracticeLogForm ref={ref} onSubmit={jest.fn()} />);

  fireEvent.press(screen.getByLabelText('ロングトーンの計測開始'));
  fireEvent.press(screen.getByLabelText('ロングトーンの停止'));

  await waitFor(() => {
    expect(screen.getByLabelText('ロングトーン')).toHaveProp('value', '2');
  });

  jest.restoreAllMocks();
});

it('手動時刻入力でタンギング分数フィールドが更新される', async () => {
  const ref = React.createRef<import('@/components/practice-log-form').PracticeLogFormRef>();
  renderWithProviders(<PracticeLogForm ref={ref} onSubmit={jest.fn()} />);

  fireEvent.press(screen.getByLabelText('タンギングの時刻で入力'));
  fireEvent.changeText(screen.getByLabelText('タンギングの開始時刻'), '10:00');
  fireEvent.changeText(screen.getByLabelText('タンギングの終了時刻'), '10:15');
  fireEvent.press(screen.getByLabelText('タンギングの適用'));

  await waitFor(() => {
    expect(screen.getByLabelText('タンギング')).toHaveProp('value', '15');
  });
});
