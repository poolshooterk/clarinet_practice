import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { AnnualGoalCard } from '@/components/annual-goal-card';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function AnnualGoalsScreen() {
  const goals = useAnnualGoalsStore((s) => s.goals);
  const loading = useAnnualGoalsStore((s) => s.loading);
  const fetchAll = useAnnualGoalsStore((s) => s.fetchAll);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const yearGoals = useMemo(
    () => goals.filter((g) => g.year === selectedYear),
    [goals, selectedYear],
  );

  return (
    <>
      <Stack.Screen options={{ title: '年間目標' }} />
      <FlatList
        data={yearGoals}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          <YStack>
            <XStack justify="space-between" items="center" px="$4" pt="$3" pb="$2">
              <Pressable onPress={() => setSelectedYear((y) => y - 1)} aria-label="前年へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＜
                </Paragraph>
              </Pressable>
              <Paragraph fontWeight="bold">{`${selectedYear}年`}</Paragraph>
              <Pressable onPress={() => setSelectedYear((y) => y + 1)} aria-label="翌年へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＞
                </Paragraph>
              </Pressable>
            </XStack>
            <Pressable
              onPress={() => router.push('/annual-goal-form')}
              style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 4 }}
            >
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 新規作成
              </Paragraph>
            </Pressable>
          </YStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Paragraph text="center" color="$color10" mt="$8">
              {`${selectedYear}年の目標がありません`}
            </Paragraph>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/annual-goal-detail?id=${item.id}`)}>
            <AnnualGoalCard goal={item} />
          </Pressable>
        )}
      />
    </>
  );
}
