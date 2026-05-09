import { Card, Paragraph, Slider, Switch, XStack, YStack } from 'tamagui';

import { useSettingsStore } from '@/store/settings';

export function SettingsCard() {
  const notify = useSettingsStore((s) => s.notify);
  const volume = useSettingsStore((s) => s.volume);
  const setNotify = useSettingsStore((s) => s.setNotify);
  const setVolume = useSettingsStore((s) => s.setVolume);

  return (
    <Card
      elevation="$2"
      borderWidth={1}
      borderColor="$borderColor"
      p="$4"
      gap="$4"
      width="100%"
      maxW={360}
    >
      <Paragraph color="$color11" size="$2">
        これらの値はアプリを再起動しても保持されます (persist + AsyncStorage)。
      </Paragraph>

      <XStack items="center" justify="space-between">
        <Paragraph color="$color12">通知 (永続)</Paragraph>
        <Switch
          theme="blue"
          checked={notify}
          onCheckedChange={setNotify}
          aria-label="通知を切り替え"
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      <YStack gap="$2">
        <XStack items="center" justify="space-between">
          <Paragraph color="$color12">音量 (永続)</Paragraph>
          <Paragraph color="$color11" testID="settings-volume-value">
            {volume}
          </Paragraph>
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
  );
}
