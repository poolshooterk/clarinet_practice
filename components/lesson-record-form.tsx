import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, TextArea, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  currentTime,
  formatDate,
  formatTime,
  type LessonRecordInput,
  lessonRecordSchema,
  today,
} from '@/forms/lesson-record';

const defaultOnSubmit = (_values: LessonRecordInput) => {
  Alert.alert('保存しました');
};

type Props = {
  defaultValues?: LessonRecordInput;
  onSubmit?: (values: LessonRecordInput) => void | Promise<void>;
  onDelete?: () => void;
};

export function LessonRecordForm({ defaultValues, onSubmit = defaultOnSubmit, onDelete }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LessonRecordInput>({
    resolver: zodResolver(lessonRecordSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? {
      date: today(),
      time: currentTime(),
      advice: '',
      notes: '',
    },
  });

  return (
    <YStack gap="$4" p="$4">
      <Controller
        control={control}
        name="date"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">日付 *</Paragraph>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="YYYY-MM-DD"
              aria-label="日付"
            />
            {Platform.OS !== 'web' && (
              <Button size="$2" onPress={() => setShowDatePicker(true)}>
                カレンダーで選択
              </Button>
            )}
            {showDatePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                mode="date"
                value={new Date()}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) onChange(formatDate(d));
                }}
              />
            )}
            <FieldError message={errors.date?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="time"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">時刻 *</Paragraph>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="HH:MM"
              aria-label="時刻"
            />
            {Platform.OS !== 'web' && (
              <Button size="$2" onPress={() => setShowTimePicker(true)}>
                時刻を選択
              </Button>
            )}
            {showTimePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                mode="time"
                value={new Date()}
                onChange={(_, d) => {
                  setShowTimePicker(false);
                  if (d) onChange(formatTime(d));
                }}
              />
            )}
            <FieldError message={errors.time?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="advice"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">アドバイス</Paragraph>
            <TextArea
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="先生からのアドバイスを入力"
              aria-label="アドバイス"
              numberOfLines={4}
            />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">気づいたこと</Paragraph>
            <TextArea
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="気づいたことを入力"
              aria-label="気づいたこと"
              numberOfLines={4}
            />
          </YStack>
        )}
      />

      <Button theme="blue" onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
        保存
      </Button>

      {onDelete && (
        <Button theme="red" variant="outlined" onPress={onDelete} mt="$4">
          このレッスン記録を削除
        </Button>
      )}
    </YStack>
  );
}
