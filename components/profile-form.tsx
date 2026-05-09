import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Card, Input, Paragraph, Slider, Switch, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { formatDate, parseYmd, profileSchema, type ProfileValues } from '@/forms/profile';

type Props = {
  onSubmit?: (values: ProfileValues) => void;
};

const defaultOnSubmit = (values: ProfileValues) => {
  Alert.alert('送信内容', JSON.stringify(values, null, 2));
};

export function ProfileForm({ onSubmit = defaultOnSubmit }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      age: undefined,
      birthday: '',
      score: 50,
      agreed: false,
    },
  });

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
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder="名前" />
            <FieldError message={errors.name?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="メールアドレス"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <FieldError message={errors.email?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="age"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Input
              value={value === undefined ? '' : String(value)}
              onChangeText={(t) => {
                if (t === '') {
                  onChange(undefined);
                  return;
                }
                const n = Number(t);
                onChange(Number.isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              placeholder="年齢 (任意)"
              keyboardType="number-pad"
            />
            <FieldError message={errors.age?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="birthday"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">生年月日</Paragraph>
            <XStack gap="$2" items="center">
              <Input
                flex={1}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              />
              {Platform.OS !== 'web' && (
                <Button onPress={() => setShowPicker(true)} aria-label="カレンダーから選択">
                  📅
                </Button>
              )}
            </XStack>
            {showPicker && Platform.OS !== 'web' && (
              <DateTimePicker
                mode="date"
                display="default"
                value={parseYmd(value) ?? new Date()}
                minimumDate={new Date('1900-01-01')}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowPicker(false);
                  if (event.type === 'set' && selectedDate) {
                    onChange(formatDate(selectedDate));
                  }
                }}
              />
            )}
            <FieldError message={errors.birthday?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="score"
        render={({ field: { onChange, value } }) => (
          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <Paragraph color="$color12">スコア (0-100)</Paragraph>
              <Paragraph color="$color11">{value}</Paragraph>
            </XStack>
            <Slider
              theme="blue"
              value={[value]}
              onValueChange={([v]) => onChange(v)}
              min={0}
              max={100}
              step={1}
            >
              <Slider.Track>
                <Slider.TrackActive />
              </Slider.Track>
              <Slider.Thumb circular index={0} />
            </Slider>
            <FieldError message={errors.score?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="agreed"
        render={({ field: { onChange, value } }) => (
          <YStack gap="$1">
            <XStack items="center" justify="space-between">
              <Paragraph color="$color12">利用規約に同意</Paragraph>
              <Switch
                theme="blue"
                checked={value}
                onCheckedChange={onChange}
                aria-label="利用規約に同意"
                testID="profile-agreed-switch"
              >
                <Switch.Thumb />
              </Switch>
            </XStack>
            <FieldError message={errors.agreed?.message} />
          </YStack>
        )}
      />

      <XStack gap="$3" justify="flex-end">
        <Button variant="outlined" onPress={() => reset()}>
          リセット
        </Button>
        <Button theme="blue" onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          送信
        </Button>
      </XStack>
    </Card>
  );
}
