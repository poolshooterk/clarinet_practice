import { Paragraph, Theme, XStack, YStack } from 'tamagui';

import { ACHIEVEMENT_LABELS, calcGoalProgress } from '@/forms/annual-goal';
import type { AnnualGoal } from '@/store/annual-goal';

type Props = {
  goal: AnnualGoal;
};

export function AnnualGoalCard({ goal }: Props) {
  const progress = calcGoalProgress(goal.milestones);
  return (
    <YStack
      mx="$3"
      mb="$2"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$2"
    >
      <XStack justify="space-between" items="baseline">
        <Paragraph fontWeight="bold">{goal.title}</Paragraph>
        {goal.numericTarget != null && (
          <Paragraph fontSize="$2" color="$color10">
            {`${goal.numericTarget}${goal.numericUnit ?? ''}`}
          </Paragraph>
        )}
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        {progress.achieved > 0 && (
          <Theme name="green">
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {`${ACHIEVEMENT_LABELS.achieved} ${progress.achieved}`}
            </Paragraph>
          </Theme>
        )}
        {progress.partial > 0 && (
          <Theme name="yellow">
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {`${ACHIEVEMENT_LABELS.partial} ${progress.partial}`}
            </Paragraph>
          </Theme>
        )}
        {progress.unachieved > 0 && (
          <Theme name="red">
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {`${ACHIEVEMENT_LABELS.unachieved} ${progress.unachieved}`}
            </Paragraph>
          </Theme>
        )}
        {progress.unreviewed > 0 && (
          <Paragraph fontSize="$1" color="$color10" bg="$color3" px="$2" py="$1" rounded="$2">
            {`未振り返り ${progress.unreviewed}`}
          </Paragraph>
        )}
        {progress.unset > 0 && (
          <Paragraph fontSize="$1" color="$color9" px="$2" py="$1">
            {`未設定 ${progress.unset}`}
          </Paragraph>
        )}
      </XStack>
    </YStack>
  );
}
