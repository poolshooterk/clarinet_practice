import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Paragraph, Theme, XStack, YStack } from 'tamagui';

import { ACHIEVEMENT_LABELS, canReviewMilestone } from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

const THEME_BY_ACHIEVEMENT = {
  achieved: 'green',
  partial: 'yellow',
  unachieved: 'red',
} as const;

type Props = {
  // 練習記録画面で選択中の月 ("YYYY-MM")
  month: string;
};

export function ThisMonthMilestonesCard({ month }: Props) {
  const goals = useAnnualGoalsStore((s) => s.goals);

  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  const rows = goals
    .filter((g) => g.year === year)
    .flatMap((g) => {
      const milestone = g.milestones.find((m) => m.month === monthNum);
      return milestone ? [{ goal: g, milestone }] : [];
    });

  if (rows.length === 0) return null;

  const canReview = canReviewMilestone(year, monthNum, new Date());

  return (
    <YStack
      mx="$3"
      mt="$3"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$2"
    >
      <Paragraph fontWeight="bold">{`${monthNum}月のマイルストーン`}</Paragraph>
      {rows.map(({ goal, milestone }) => (
        <Pressable
          key={milestone.id}
          onPress={() =>
            router.push(`/monthly-milestone-form?goalId=${goal.id}&id=${milestone.id}`)
          }
        >
          <YStack
            p="$2"
            bg="$color2"
            rounded="$2"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$1"
          >
            <XStack justify="space-between" items="baseline">
              <Paragraph fontSize="$2" color="$color10">
                {goal.title}
              </Paragraph>
              {milestone.achievement != null && (
                <Theme name={THEME_BY_ACHIEVEMENT[milestone.achievement]}>
                  <Paragraph
                    fontSize="$1"
                    color="$color11"
                    bg="$color3"
                    px="$2"
                    py="$1"
                    rounded="$2"
                  >
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
            {canReview && milestone.achievement == null && (
              <Paragraph fontSize="$2" color="$blue9">
                振り返る ＞
              </Paragraph>
            )}
          </YStack>
        </Pressable>
      ))}
    </YStack>
  );
}
