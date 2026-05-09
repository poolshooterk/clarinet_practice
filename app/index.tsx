import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Card, H1, H2, Input, Paragraph, Slider, Switch, XStack, YStack } from 'tamagui';

import { ProfileForm } from '@/components/profile-form';
import { SettingsCard } from '@/components/settings-card';
import { useCounterStore } from '@/store/counter';

export default function Index() {
  const [text, setText] = useState('');
  const [notify, setNotify] = useState(true);
  const [volume, setVolume] = useState(40);

  const count = useCounterStore((s) => s.count);
  const increment = useCounterStore((s) => s.increment);
  const decrement = useCounterStore((s) => s.decrement);
  const resetCount = useCounterStore((s) => s.reset);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <YStack flex={1} items="center" p="$6" gap="$5" bg="$background">
        <YStack items="center" gap="$2" maxW={420}>
          <H1 color="$color12">Tamagui works</H1>
          <Paragraph text="center" color="$color11">
            このページは Tamagui
            のセットアップ確認用です。各コンポーネントが描画され、状態が更新されれば成功です。
          </Paragraph>
        </YStack>

        <Card
          elevation="$2"
          borderWidth={1}
          borderColor="$borderColor"
          p="$4"
          gap="$4"
          width="100%"
          maxW={360}
        >
          <Input value={text} onChangeText={setText} placeholder="テキストを入力" />

          <XStack items="center" justify="space-between">
            <Paragraph color="$color12">通知</Paragraph>
            <Switch theme="blue" checked={notify} onCheckedChange={setNotify}>
              <Switch.Thumb />
            </Switch>
          </XStack>

          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <Paragraph color="$color12">音量</Paragraph>
              <Paragraph color="$color11">{volume}</Paragraph>
            </XStack>
            <Slider
              theme="blue"
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              max={100}
              step={1}
            >
              <Slider.Track>
                <Slider.TrackActive />
              </Slider.Track>
              <Slider.Thumb circular index={0} />
            </Slider>
          </YStack>
        </Card>

        <XStack gap="$3">
          <Button theme="blue">Primary</Button>
          <Button variant="outlined">Outlined</Button>
        </XStack>

        <YStack items="center" gap="$2" maxW={420}>
          <H2 color="$color12">Form demo</H2>
          <Paragraph text="center" color="$color11">
            React Hook Form + zod + Tamagui の動作確認用フォームです。Controller
            で各入力を制御し、zod スキーマでバリデーションします。
          </Paragraph>
        </YStack>

        <ProfileForm />

        <YStack items="center" gap="$2" maxW={420}>
          <H2 color="$color12">Zustand demo</H2>
          <Paragraph text="center" color="$color11">
            Zustand によるグローバル状態の動作確認です。Counter は非永続、下の設定カードは
            AsyncStorage で永続化されます。
          </Paragraph>
        </YStack>

        <Card
          elevation="$2"
          borderWidth={1}
          borderColor="$borderColor"
          p="$4"
          gap="$4"
          width="100%"
          maxW={360}
        >
          <XStack items="center" justify="space-between">
            <Paragraph color="$color12">Counter</Paragraph>
            <Paragraph color="$color11">{count}</Paragraph>
          </XStack>
          <XStack gap="$3" justify="flex-end">
            <Button variant="outlined" onPress={resetCount}>
              Reset
            </Button>
            <Button onPress={decrement}>-1</Button>
            <Button theme="blue" onPress={increment}>
              +1
            </Button>
          </XStack>
        </Card>

        <SettingsCard />
      </YStack>
    </ScrollView>
  );
}
