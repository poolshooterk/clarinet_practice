import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { PracticeChart } from '@/components/practice-chart';
import { BASIC_MENUS, today } from '@/forms/practice-log';
import { loadRecordedIds } from '@/lib/recording';
import { calcSessionTime, usePracticeLogStore } from '@/store/practice-log';

function dayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

function formatTimeLabel(basic: number, nonBasic: number): string | null {
  const parts: string[] = [];
  if (basic > 0) parts.push(`基礎練習: ${basic}分`);
  if (nonBasic > 0) parts.push(`基礎練習以外: ${nonBasic}分`);
  return parts.length > 0 ? parts.join(' / ') : null;
}

export default function PracticeLogScreen() {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const loading = usePracticeLogStore((s) => s.loading);
  const fetchAll = usePracticeLogStore((s) => s.fetchAll);

  const currentMonth = today().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      loadRecordedIds().then(setRecordedIds);
    }, [fetchAll]),
  );

  const monthSessions = sessions.filter((s) => s.practicedAt.startsWith(selectedMonth));
  const monthTotals = monthSessions.reduce(
    (acc, s) => {
      const { basic, nonBasic } = calcSessionTime(s);
      return { basic: acc.basic + basic, nonBasic: acc.nonBasic + nonBasic };
    },
    { basic: 0, nonBasic: 0 },
  );

  function prevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function nextMonth() {
    if (selectedMonth >= currentMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: '練習記録' }} />
      <FlatList
        data={monthSessions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <YStack>
            <XStack justify="space-between" items="center" px="$4" pt="$3" pb="$1">
              <Pressable onPress={prevMonth} aria-label="前月へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＜
                </Paragraph>
              </Pressable>
              <YStack items="center" gap="$1">
                <Paragraph fontWeight="bold">{formatMonthLabel(selectedMonth)}</Paragraph>
                <Paragraph fontSize="$2" color="$color10">
                  {(() => {
                    const total = monthTotals.basic + monthTotals.nonBasic;
                    return total > 0
                      ? `${monthSessions.length}回 / 合計: ${total}分`
                      : `${monthSessions.length}回 / 練習時間未記録`;
                  })()}
                </Paragraph>
              </YStack>
              <Pressable
                onPress={nextMonth}
                disabled={selectedMonth >= currentMonth}
                aria-label="次月へ"
              >
                <Paragraph
                  color={selectedMonth >= currentMonth ? '$color9' : '$blue9'}
                  fontSize="$5"
                >
                  ＞
                </Paragraph>
              </Pressable>
            </XStack>
            {monthSessions.length > 0 && (
              <PracticeChart sessions={monthSessions} month={selectedMonth} />
            )}
            <Pressable
              onPress={() => router.push('/practice-log-form')}
              style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 4 }}
            >
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 記録
              </Paragraph>
            </Pressable>
          </YStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Paragraph text="center" color="$color10" mt="$8">
              記録がまだありません
            </Paragraph>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/practice-log-form?id=${item.id}`)}>
            <YStack
              mx="$3"
              mb="$2"
              p="$3"
              bg="$color1"
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
            >
              <XStack justify="space-between" items="baseline" mb="$1">
                <Paragraph fontWeight="bold">
                  {`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}
                </Paragraph>
                <XStack gap="$2" items="center">
                  {recordedIds.has(item.id) && (
                    <Paragraph
                      fontSize="$1"
                      color="$blue9"
                      bg="$blue3"
                      px="$1"
                      rounded="$1"
                      borderWidth={1}
                      borderColor="$blue7"
                    >
                      ♪
                    </Paragraph>
                  )}
                  {(() => {
                    const sessionTime = calcSessionTime(item);
                    const total = item.totalMinutes ?? sessionTime.basic + sessionTime.nonBasic;
                    return total > 0 ? (
                      <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
                        {`合計: ${total}分`}
                      </Paragraph>
                    ) : null;
                  })()}
                </XStack>
              </XStack>
              {(() => {
                const { basic, nonBasic } = calcSessionTime(item);
                const label = formatTimeLabel(basic, nonBasic);
                return label ? (
                  <Paragraph fontSize="$2" color="$color10" mb="$1">
                    {label}
                  </Paragraph>
                ) : null;
              })()}
              {item.memo ? (
                <Paragraph fontSize="$2" color="$color11" numberOfLines={1} mb="$1">
                  {item.memo}
                </Paragraph>
              ) : null}
              {item.otherMinutes != null && (
                <Paragraph fontSize="$2" color="$color10">
                  {`その他: ${item.otherMinutes}分`}
                </Paragraph>
              )}
              {item.otherMemo ? (
                <Paragraph fontSize="$2" color="$color11" numberOfLines={1}>
                  {item.otherMemo}
                </Paragraph>
              ) : null}
              {item.textbookEntries.map((entry) => (
                <XStack key={entry.textbookId} gap="$2" items="center">
                  <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
                  {entry.durationMinutes != null && (
                    <Paragraph fontSize="$2" color="$color10">
                      {`${entry.durationMinutes}分`}
                    </Paragraph>
                  )}
                  {entry.tempoBpm != null && (
                    <Paragraph fontSize="$2" color="$color10">
                      {`♩=${entry.tempoBpm}`}
                    </Paragraph>
                  )}
                  <Paragraph fontSize="$2" color="$blue9" ml="auto">
                    {`p.${entry.currentPage}`}
                  </Paragraph>
                </XStack>
              ))}
              {item.basicMenuEntries.length > 0 && (
                <XStack gap="$3" mt="$1" flexWrap="wrap">
                  {item.basicMenuEntries.map((entry) => {
                    const label =
                      BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType;
                    const suffix =
                      entry.menuType === 'tonguing' && entry.tempoBpms.length > 0
                        ? ` ♩=${entry.tempoBpms.join(', ')}`
                        : '';
                    return (
                      <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
                        {`${label}: ${entry.durationMinutes}分${suffix}`}
                      </Paragraph>
                    );
                  })}
                </XStack>
              )}
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
