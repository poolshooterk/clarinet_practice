import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

export default function Settings() {
  return (
    <YStack flex={1} p="$4" gap="$3">
      <Pressable onPress={() => router.push('/textbooks')}>
        <XStack
          items="center"
          justify="space-between"
          p="$4"
          bg="$color2"
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Paragraph>📚 教本管理</Paragraph>
          <Paragraph color="$color10">›</Paragraph>
        </XStack>
      </Pressable>
      <Pressable onPress={() => router.push('/accessories')}>
        <XStack
          items="center"
          justify="space-between"
          p="$4"
          bg="$color2"
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Paragraph>🎵 消耗品管理</Paragraph>
          <Paragraph color="$color10">›</Paragraph>
        </XStack>
      </Pressable>
    </YStack>
  );
}
