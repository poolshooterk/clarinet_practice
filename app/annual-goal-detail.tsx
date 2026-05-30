import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Button, Paragraph, Theme, YStack } from 'tamagui';

import { MonthlyMilestoneCard } from '@/components/monthly-milestone-card';
import { ACHIEVEMENT_LABELS, canReviewAnnualGoal } from '@/forms/annual-goal';
import { useAnnualGoalsStore, type Milestone } from '@/store/annual-goal';

const THEME_BY_ACHIEVEMENT = {
  achieved: 'green',
  partial: 'yellow',
  unachieved: 'red',
} as const;

export default function AnnualGoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useAnnualGoalsStore((s) => s.goals);
  const fetchAll = useAnnualGoalsStore((s) => s.fetchAll);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const goal = useMemo(() => goals.find((g) => g.id === id), [goals, id]);
  const milestoneByMonth = useMemo(() => {
    const map = new Map<number, Milestone>();
    goal?.milestones.forEach((m) => map.set(m.month, m));
    return map;
  }, [goal]);

  if (!goal) {
    return (
      <>
        <Stack.Screen options={{ title: '年間目標' }} />
        <YStack p="$4">
          <Paragraph>目標が見つかりませんでした。</Paragraph>
        </YStack>
      </>
    );
  }

  const yearEndAvailable = canReviewAnnualGoal(goal.year, new Date());

  return (
    <>
      <Stack.Screen
        options={{
          title: `${goal.year}年: ${goal.title}`,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/annual-goal-form?id=${goal.id}`)}>
              <Paragraph color="$blue9" mr="$3">
                編集
              </Paragraph>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={Array.from({ length: 12 }, (_, i) => i + 1)}
        keyExtractor={(m) => String(m)}
        ListHeaderComponent={
          goal.numericTarget != null ? (
            <Paragraph mx="$3" mt="$2" mb="$3" color="$color10">
              {`年間目標: ${goal.numericTarget}${goal.numericUnit ?? ''}`}
            </Paragraph>
          ) : null
        }
        renderItem={({ item: monthNum }) => {
          const milestone = milestoneByMonth.get(monthNum) ?? null;
          const onPress = () =>
            router.push(
              milestone
                ? `/monthly-milestone-form?goalId=${goal.id}&id=${milestone.id}`
                : `/monthly-milestone-form?goalId=${goal.id}&month=${monthNum}`,
            );
          return <MonthlyMilestoneCard month={monthNum} milestone={milestone} onPress={onPress} />;
        }}
        ListFooterComponent={
          <YStack
            mx="$3"
            mt="$3"
            mb="$8"
            p="$3"
            bg="$color1"
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$2"
          >
            <Paragraph fontWeight="bold">年末振り返り</Paragraph>
            {goal.yearEndAchievement ? (
              <Theme name={THEME_BY_ACHIEVEMENT[goal.yearEndAchievement]}>
                <Paragraph fontSize="$2" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
                  {ACHIEVEMENT_LABELS[goal.yearEndAchievement]}
                </Paragraph>
              </Theme>
            ) : (
              <Paragraph fontSize="$2" color="$color9">
                {yearEndAvailable ? '未記入' : '12月最終週から記入できます'}
              </Paragraph>
            )}
            {goal.yearEndReviewText ? (
              <Paragraph fontSize="$2">{goal.yearEndReviewText}</Paragraph>
            ) : null}
            {yearEndAvailable && (
              <Button
                size="$2"
                onPress={() =>
                  router.push(`/monthly-milestone-form?goalId=${goal.id}&month=12`)
                }
                theme="blue"
              >
                12月マイルストーンを編集
              </Button>
            )}
          </YStack>
        }
      />
    </>
  );
}
