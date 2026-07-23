import { router } from 'expo-router';
import { Button, Paragraph, XStack, YStack } from 'tamagui';

import { HOMEWORK_STATUS_LABELS, type HomeworkStatus } from '@/forms/homework';
import { type Homework, useLessonRecordStore } from '@/store/lesson-record';

const NEXT_STATUS: Record<HomeworkStatus, HomeworkStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
};

type Props = {
  lessonRecordId: string;
  homework: Homework[];
};

export function LessonHomeworkSection({ lessonRecordId, homework }: Props) {
  const updateHomeworkStatus = useLessonRecordStore((s) => s.updateHomeworkStatus);

  return (
    <YStack gap="$2">
      {homework.length === 0 ? (
        <Paragraph fontSize="$2" color="$color10">
          宿題はありません
        </Paragraph>
      ) : (
        homework.map((h) => (
          <XStack
            key={h.id}
            gap="$2"
            items="center"
            p="$2"
            bg="$color2"
            rounded="$3"
            justify="space-between"
          >
            <YStack flex={1} gap="$1">
              <Paragraph
                onPress={() => router.push(`/homework-form?id=${h.id}`)}
                accessibilityLabel={`${h.content} を編集`}
              >
                {h.content}
              </Paragraph>
              {h.dueDate ? (
                <Paragraph fontSize="$1" color="$color10">
                  {`期限 ${h.dueDate}`}
                </Paragraph>
              ) : null}
            </YStack>
            <Button
              size="$2"
              theme={
                h.status === 'done' ? 'green' : h.status === 'in_progress' ? 'blue' : undefined
              }
              onPress={() => updateHomeworkStatus(h.id, NEXT_STATUS[h.status])}
              aria-label={`${h.content} のステータスを進める`}
            >
              {HOMEWORK_STATUS_LABELS[h.status]}
            </Button>
          </XStack>
        ))
      )}
      <Button
        size="$2"
        onPress={() => router.push(`/homework-form?lessonRecordId=${lessonRecordId}`)}
        aria-label="宿題を追加"
      >
        ＋ 宿題を追加
      </Button>
    </YStack>
  );
}
