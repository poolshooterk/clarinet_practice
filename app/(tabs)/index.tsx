import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { PracticeChart } from '@/components/practice-chart';
import { ThisMonthMilestonesCard } from '@/components/this-month-milestones-card';
import { BASIC_MENUS, today } from '@/forms/practice-log';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import {
  calcSessionTime,
  groupSessionsByDate,
  type PracticeSession,
  usePracticeLogStore,
} from '@/store/practice-log';

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

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      useAnnualGoalsStore.getState().fetchAll();
    }, [fetchAll]),
  );

  const monthSessions = sessions.filter((s) => s.practicedAt.startsWith(selectedMonth));
  const monthGroups = groupSessionsByDate(monthSessions);
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
        data={monthGroups}
        keyExtractor={(group) => group.date}
        ListHeaderComponent={
          <YStack>
            <ThisMonthMilestonesCard month={selectedMonth} />
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
                    // 1 日に複数回記録できるため、平均の分母は記録件数ではなく練習した日数
                    // total > 0 は monthGroups.length > 0 を含意するため除算は安全
                    const avg = total > 0 ? Math.round(total / monthGroups.length) : 0;
                    const count = `${monthGroups.length}日 / ${monthSessions.length}回`;
                    return total > 0 ? `${count} / 平均: ${avg}分/日` : `${count} / 練習時間未記録`;
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
            <XStack justify="space-between" items="center" px="$4" py="$1">
              <Pressable
                onPress={() => router.push('/embouchure-checklist')}
                aria-label="アンブシュア確認チェックリストを開く"
              >
                <Paragraph color="$blue9" fontSize="$2">
                  アンブシュア確認
                </Paragraph>
              </Pressable>
              <Pressable onPress={() => router.push('/practice-log-form')}>
                <Paragraph color="$blue9" fontSize="$2">
                  ＋ 記録
                </Paragraph>
              </Pressable>
            </XStack>
          </YStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Paragraph text="center" color="$color10" mt="$8">
              記録がまだありません
            </Paragraph>
          ) : null
        }
        renderItem={({ item: group }) => (
          <YStack mb="$2">
            <XStack justify="space-between" items="baseline" mx="$3" mb="$1">
              <Paragraph fontWeight="bold">{`${group.date}（${dayOfWeek(group.date)}）`}</Paragraph>
              {(() => {
                const total = group.sessions.reduce((acc, s) => acc + sessionTotal(s), 0);
                return total > 0 ? (
                  <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
                    {`合計: ${total}分`}
                  </Paragraph>
                ) : null;
              })()}
            </XStack>
            {group.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                // 同じ日に複数回ある日だけ「N回目」を出す (通常の 1 回だけの日は従来どおり)
                showSessionNo={group.sessions.length > 1}
              />
            ))}
          </YStack>
        )}
      />
    </>
  );
}

function sessionTotal(session: PracticeSession): number {
  const { basic, nonBasic } = calcSessionTime(session);
  return session.totalMinutes ?? basic + nonBasic;
}

function SessionCard({
  session,
  showSessionNo,
}: {
  session: PracticeSession;
  showSessionNo: boolean;
}) {
  const { basic, nonBasic } = calcSessionTime(session);
  const timeLabel = formatTimeLabel(basic, nonBasic);
  const total = session.totalMinutes ?? basic + nonBasic;

  return (
    <Pressable onPress={() => router.push(`/practice-log-form?id=${session.id}`)}>
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
          <XStack gap="$2" items="center">
            {showSessionNo && (
              <Paragraph
                fontSize="$1"
                color="$blue9"
                bg="$blue3"
                px="$1"
                rounded="$1"
                borderWidth={1}
                borderColor="$blue7"
              >
                {`${session.sessionNo}回目`}
              </Paragraph>
            )}
            {session.startTime || session.endTime ? (
              <Paragraph fontSize="$2" color="$color10">
                {session.startTime && session.endTime
                  ? `${session.startTime}–${session.endTime}`
                  : (session.startTime ?? session.endTime)}
              </Paragraph>
            ) : null}
          </XStack>
          <XStack gap="$2" items="center">
            {session.recordings.length > 0 && (
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
            {total > 0 ? (
              <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
                {`合計: ${total}分`}
              </Paragraph>
            ) : null}
          </XStack>
        </XStack>
        {timeLabel ? (
          <Paragraph fontSize="$2" color="$color10" mb="$1">
            {timeLabel}
          </Paragraph>
        ) : null}
        {session.memo ? (
          <Paragraph fontSize="$2" color="$color11" numberOfLines={1} mb="$1">
            {session.memo}
          </Paragraph>
        ) : null}
        {session.otherMinutes != null && (
          <Paragraph fontSize="$2" color="$color10">
            {`その他: ${session.otherMinutes}分`}
          </Paragraph>
        )}
        {session.otherMemo ? (
          <Paragraph fontSize="$2" color="$color11" numberOfLines={1}>
            {session.otherMemo}
          </Paragraph>
        ) : null}
        {session.textbookEntries.map((entry) => (
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
        {session.basicMenuEntries.length > 0 && (
          <XStack gap="$3" mt="$1" flexWrap="wrap">
            {session.basicMenuEntries.map((entry) => {
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
  );
}
