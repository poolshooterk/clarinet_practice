import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
} from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, Select, TextArea, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { type RecordingChange, RecordingSection } from '@/components/form/recording-section';
import {
  currentTime,
  formatDate,
  formatTime,
  type LessonRecordInput,
  lessonRecordSchema,
  today,
} from '@/forms/lesson-record';
import type { SessionRecording } from '@/store/practice-log';
import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';

type TextbookEntryRowProps = {
  index: number;
  control: Control<LessonRecordInput>;
  errors: FieldErrors<LessonRecordInput>;
  textbooks: Textbook[];
  watchedEntries: LessonRecordInput['textbookEntries'];
  onRemove: () => void;
};

function TextbookEntryRow({
  index,
  control,
  errors,
  textbooks,
  watchedEntries,
  onRemove,
}: TextbookEntryRowProps) {
  const otherSelectedIds = new Set(
    watchedEntries
      .filter((_, i) => i !== index)
      .map((e) => e.textbookId)
      .filter(Boolean),
  );

  return (
    <YStack gap="$2" p="$3" bg="$color2" rounded="$3">
      <XStack gap="$2" items="center">
        <Controller
          control={control}
          name={`textbookEntries.${index}.textbookId`}
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack flex={1} gap="$1">
              <Select value={value} onValueChange={onChange}>
                <Select.Trigger flex={1} onBlur={onBlur} aria-label={`教本を選択 ${index + 1}`}>
                  <Select.Value placeholder="教本を選択" />
                </Select.Trigger>
                <Select.Content>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    {textbooks.map((tb, i) => (
                      <Select.Item
                        key={tb.id}
                        index={i}
                        value={tb.id}
                        disabled={otherSelectedIds.has(tb.id)}
                      >
                        <Select.ItemText>{tb.title}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
              <FieldError message={errors.textbookEntries?.[index]?.textbookId?.message} />
            </YStack>
          )}
        />
        <Button
          size="$2"
          theme="red"
          onPress={onRemove}
          aria-label={`エントリ ${index + 1} を削除`}
        >
          ✕
        </Button>
      </XStack>

      <YStack gap="$1">
        <XStack gap="$2" items="center">
          <Paragraph fontSize="$2" color="$color10">
            現在ページ:
          </Paragraph>
          <Controller
            control={control}
            name={`textbookEntries.${index}.currentPage`}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                width={64}
                value={value !== undefined ? String(value) : ''}
                onChangeText={(t) => {
                  const n = Number(t);
                  onChange(t === '' || isNaN(n) ? undefined : n);
                }}
                onBlur={onBlur}
                keyboardType="numeric"
                aria-label={`ページ ${index + 1}`}
              />
            )}
          />
        </XStack>
        <FieldError message={errors.textbookEntries?.[index]?.currentPage?.message} />
      </YStack>

      <Controller
        control={control}
        name={`textbookEntries.${index}.durationMinutes`}
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph fontSize="$2" color="$color10">
              練習時間（分）任意
            </Paragraph>
            <Input
              value={value !== undefined ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number(t);
                onChange(t === '' || isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              placeholder="例: 15"
              keyboardType="numeric"
              aria-label={`教本練習時間 ${index + 1}`}
            />
          </YStack>
        )}
      />
      <FieldError message={errors.textbookEntries?.[index]?.durationMinutes?.message} />

      <Controller
        control={control}
        name={`textbookEntries.${index}.tempoBpm`}
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph fontSize="$2" color="$color10">
              テンポ BPM（任意）
            </Paragraph>
            <Input
              value={value !== undefined ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number(t);
                onChange(t === '' || isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              placeholder="例: 120"
              keyboardType="numeric"
              aria-label={`テンポ ${index + 1}`}
            />
          </YStack>
        )}
      />
      <FieldError message={errors.textbookEntries?.[index]?.tempoBpm?.message} />
    </YStack>
  );
}

const defaultOnSubmit = (_values: LessonRecordInput, _change: RecordingChange) => {
  Alert.alert('保存しました');
};

type Props = {
  defaultValues?: LessonRecordInput;
  existingRecordings?: SessionRecording[];
  onSubmit?: (values: LessonRecordInput, recChange: RecordingChange) => void | Promise<void>;
  onDelete?: () => void;
};

export function LessonRecordForm({
  defaultValues,
  existingRecordings = [],
  onSubmit = defaultOnSubmit,
  onDelete,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [recChange, setRecChange] = useState<RecordingChange>({ toAdd: [], toDelete: [] });

  const textbooks = useTextbookCatalogStore((s) => s.textbooks);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LessonRecordInput>({
    resolver: zodResolver(lessonRecordSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? {
      date: today(),
      time: currentTime(),
      advice: '',
      notes: '',
      textbookEntries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const watchedEntries = watch('textbookEntries') ?? [];

  async function handleSave(values: LessonRecordInput) {
    await onSubmit(values, recChange);
  }

  return (
    <YStack gap="$4" p="$4">
      <RecordingSection existingRecordings={existingRecordings} onChange={setRecChange} />
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

      <YStack gap="$2">
        <Paragraph color="$color12">教本の進捗</Paragraph>
        {fields.map((field, index) => (
          <TextbookEntryRow
            key={field.id}
            index={index}
            control={control}
            errors={errors}
            textbooks={textbooks}
            watchedEntries={watchedEntries}
            onRemove={() => remove(index)}
          />
        ))}
        <Button onPress={() => append({ textbookId: '', currentPage: 0 })} aria-label="教本を追加">
          ＋ 教本を追加
        </Button>
      </YStack>

      <Button theme="blue" onPress={handleSubmit(handleSave)} disabled={isSubmitting}>
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
