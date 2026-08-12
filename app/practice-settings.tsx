import { Stack } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { AUTO_START_MENUS } from '@/forms/practice-log';
import { usePracticePreferenceStore } from '@/store/practice-preference';

export default function PracticeSettingsScreen() {
  const autoStartMenu = usePracticePreferenceStore((s) => s.autoStartMenu);
  const setAutoStartMenu = usePracticePreferenceStore((s) => s.setAutoStartMenu);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '練習設定' }} />
      <ScrollView>
        <YStack p="$4" gap="$3">
          <YStack gap="$1">
            <Paragraph color="$color12">練習開始時に自動で計測するメニュー</Paragraph>
            <Paragraph fontSize="$2" color="$color10">
              練習記録の「練習開始」を押したときに、選んだメニューのタイマーも同時に開始します。
            </Paragraph>
          </YStack>
          <YStack gap="$2">
            {AUTO_START_MENUS.map((menu) => {
              const selected = menu.value === autoStartMenu;
              return (
                <Pressable
                  key={menu.value}
                  onPress={() => setAutoStartMenu(menu.value)}
                  aria-label={`自動計測: ${menu.label}`}
                >
                  <XStack
                    items="center"
                    justify="space-between"
                    p="$3"
                    bg={selected ? '$blue3' : '$color2'}
                    rounded="$4"
                    borderWidth={1}
                    borderColor={selected ? '$blue7' : '$borderColor'}
                  >
                    <Paragraph color={selected ? '$blue11' : '$color12'}>{menu.label}</Paragraph>
                    {selected && <Paragraph color="$blue9">✓</Paragraph>}
                  </XStack>
                </Pressable>
              );
            })}
          </YStack>
          <Paragraph fontSize="$2" color="$color10">
            「教本 (1つ目)」は、練習記録の教本欄の 1
            行目のタイマーを開始します。教本が未入力のときは何も開始しません。
          </Paragraph>
        </YStack>
      </ScrollView>
    </>
  );
}
