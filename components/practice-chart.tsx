import { useMemo } from 'react';
import { View } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { today } from '@/forms/practice-log';
import type { PracticeSession } from '@/store/practice-log';

const MAX_BAR_HEIGHT = 60;
const LABEL_DAYS = [1, 8, 15, 22];

export function buildDayMap(sessions: PracticeSession[], month: string): Record<number, number> {
  const map: Record<number, number> = {};
  for (const s of sessions) {
    if (!s.practicedAt.startsWith(month)) continue;
    if (!s.durationMinutes) continue;
    const day = Number(s.practicedAt.slice(8, 10));
    map[day] = (map[day] ?? 0) + s.durationMinutes;
  }
  return map;
}

type Props = { sessions: PracticeSession[]; month: string };

export function PracticeChart({ sessions, month }: Props) {
  const [y, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const dayMap = useMemo(() => buildDayMap(sessions, month), [sessions, month]);
  const maxMinutes = Math.max(1, ...Object.values(dayMap));

  const todayStr = today();
  const isCurrentMonth = month === todayStr.slice(0, 7);
  const todayDay = Number(todayStr.slice(8, 10));

  return (
    <YStack px="$3" pt="$2" pb="$1">
      <XStack height={MAX_BAR_HEIGHT} items="flex-end" gap={1}>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const minutes = dayMap[day] ?? 0;
          const barH = minutes > 0 ? Math.round((minutes / maxMinutes) * MAX_BAR_HEIGHT) : 0;
          const isToday = isCurrentMonth && day === todayDay;
          return (
            <View
              key={day}
              style={{
                flex: 1,
                height: barH,
                backgroundColor: isToday ? '#3b82f6' : '#93c5fd',
                borderRadius: 1,
              }}
            />
          );
        })}
      </XStack>
      <XStack>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          return (
            <View key={day} style={{ flex: 1, alignItems: 'center' }}>
              {LABEL_DAYS.includes(day) && (
                <Paragraph fontSize="$1" color="$color9">
                  {day}
                </Paragraph>
              )}
            </View>
          );
        })}
      </XStack>
    </YStack>
  );
}
