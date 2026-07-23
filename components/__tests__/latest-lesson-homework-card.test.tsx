import { fireEvent } from '@testing-library/react-native';

import { LatestLessonHomeworkCard } from '@/components/latest-lesson-homework-card';
import { useLessonRecordStore } from '@/store/lesson-record';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

describe('LatestLessonHomeworkCard', () => {
  it('ステータストグルで updateHomeworkStatus が呼ばれる', () => {
    const updateHomeworkStatus = jest.fn();
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-07-20T10:00:00+09:00',
          advice: null,
          notes: null,
          textbookEntries: [],
          recordings: [],
          homework: [
            {
              id: 'hw-1',
              content: 'ロングトーン強化',
              dueDate: null,
              textbookId: null,
              textbookTitle: '',
              reviewNote: null,
              status: 'not_started',
              completedAt: null,
            },
          ],
        },
      ],
      loading: false,
      updateHomeworkStatus,
    } as any);

    const { getByLabelText } = renderWithProviders(<LatestLessonHomeworkCard />);
    fireEvent.press(getByLabelText('ロングトーン強化 のステータスを進める'));
    expect(updateHomeworkStatus).toHaveBeenCalledWith('hw-1', 'in_progress');
  });

  it('レッスンが無ければ何も描画しない', () => {
    useLessonRecordStore.setState({ records: [], loading: false } as any);
    const { queryByText } = renderWithProviders(<LatestLessonHomeworkCard />);
    expect(queryByText('今の宿題')).toBeNull();
  });
});
