import { Paragraph, YStack } from 'tamagui';

import { LessonHomeworkSection } from '@/components/lesson-homework-section';
import { useLessonRecordStore } from '@/store/lesson-record';

export function LatestLessonHomeworkCard() {
  const records = useLessonRecordStore((s) => s.records);
  const latest = records[0]; // held_at desc で最新
  if (!latest) return null;

  return (
    <YStack
      mx="$3"
      mt="$3"
      mb="$1"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$2"
    >
      <Paragraph fontWeight="bold">今の宿題</Paragraph>
      <LessonHomeworkSection lessonRecordId={latest.id} homework={latest.homework} />
    </YStack>
  );
}
