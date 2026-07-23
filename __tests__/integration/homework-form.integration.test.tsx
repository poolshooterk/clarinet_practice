import { fireEvent, waitFor } from '@testing-library/react-native';

import HomeworkForm from '@/app/homework-form';
import { useLessonRecordStore } from '@/store/lesson-record';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ lessonRecordId: 'lr-1' }),
}));

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

describe('homework-form integration', () => {
  it('内容を入力して保存すると addHomework が呼ばれる', async () => {
    const addHomework = jest.fn().mockResolvedValue({ ok: true });
    useLessonRecordStore.setState({ records: [], addHomework } as any);

    const { getByLabelText } = renderWithProviders(<HomeworkForm />);
    fireEvent.changeText(getByLabelText('宿題の内容'), 'ロングトーン強化');
    fireEvent.press(getByLabelText('保存'));

    await waitFor(() => expect(addHomework).toHaveBeenCalled());
    expect(addHomework.mock.calls[0][0]).toBe('lr-1');
    expect(addHomework.mock.calls[0][1].content).toBe('ロングトーン強化');
  });
});
