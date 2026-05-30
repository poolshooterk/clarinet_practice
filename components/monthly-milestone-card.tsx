import { Paragraph, Theme, XStack, YStack } from 'tamagui';

import { ACHIEVEMENT_LABELS } from '@/forms/annual-goal';
import type { Milestone } from '@/store/annual-goal';

type Props = {
  month: number;
  milestone: Milestone | null;
  onPress?: () => void;
};

const THEME_BY_ACHIEVEMENT = {
  achieved: 'green',
  partial: 'yellow',
  unachieved: 'red',
} as const;

export function MonthlyMilestoneCard({ month, milestone, onPress }: Props) {
  if (!milestone) {
    return (
      <YStack
        mx="$3"
        mb="$2"
        p="$3"
        bg="$color1"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
        gap="$1"
        onPress={onPress}
      >
        <Paragraph fontWeight="bold">{`${month}月`}</Paragraph>
        <Paragraph fontSize="$2" color="$color9">
          未設定（タップで追加）
        </Paragraph>
      </YStack>
    );
  }
  const themeName =
    milestone.achievement != null ? THEME_BY_ACHIEVEMENT[milestone.achievement] : null;
  return (
    <YStack
      mx="$3"
      mb="$2"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$1"
      onPress={onPress}
    >
      <XStack justify="space-between" items="baseline">
        <Paragraph fontWeight="bold">{`${month}月`}</Paragraph>
        {milestone.achievement != null && themeName != null && (
          <Theme name={themeName}>
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {ACHIEVEMENT_LABELS[milestone.achievement]}
            </Paragraph>
          </Theme>
        )}
      </XStack>
      <Paragraph fontSize="$3">{milestone.text}</Paragraph>
      {milestone.numericTarget != null && (
        <Paragraph fontSize="$2" color="$color10">
          {`目標: ${milestone.numericTarget}${milestone.numericUnit ?? ''}`}
        </Paragraph>
      )}
      {milestone.reviewText ? (
        <Paragraph fontSize="$2" color="$color11">
          {`振り返り: ${milestone.reviewText}`}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
