import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  BASIC_MENUS,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
};

export type PracticeLogFormRef = {
  submit: () => void;
};

export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit },
  ref,
) {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const [showPicker, setShowPicker] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PracticeLogInput>({
    resolver: zodResolver(practiceLogSchema),
    mode: 'onTouched',
    defaultValues: {
      practicedAt: today(),
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpm: undefined,
      memo: '',
      textbookEntries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const watchedEntries = watch('textbookEntries') ?? [];
  const watchedLongTone = watch('longToneMinutes');
  const watchedTonguing = watch('tonguingMinutes');
  const totalMinutes = (watchedLongTone ?? 0) + (watchedTonguing ?? 0);

  const submitForm = handleSubmit(onSubmit);
  useImperativeHandle(ref, () => ({ submit: submitForm }));

  return (
    <ScrollView>
      <YStack gap="$4" p="$4">
        {/* 日付 */}
        <Controller
          control={control}
          name="practicedAt"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">日付 *</Paragraph>
              <XStack gap="$2" items="center">
                <Input
                  flex={1}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  aria-label="日付"
                />
                {Platform.OS !== 'web' && (
                  <Button size="$2" onPress={() => setShowPicker(true)} aria-label="カレンダー">
                    カレンダー
                  </Button>
                )}
              </XStack>
              {showPicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={(() => {
                    const parts = value.split('-');
                    if (parts.length === 3) {
                      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    }
                    return new Date();
                  })()}
                  mode="date"
                  onChange={(_, date) => {
                    setShowPicker(false);
                    if (date) onChange(formatDate(date));
                  }}
                />
              )}
              <FieldError message={errors.practicedAt?.message} />
            </YStack>
          )}
        />

        {/* 基礎練習 */}
        <YStack gap="$2">
          <Paragraph color="$color12">基礎練習</Paragraph>

          {BASIC_MENUS.map(({ type, label }) => {
            const fieldName = type === 'long_tone' ? 'longToneMinutes' : 'tonguingMinutes';
            const ariaLabel = type === 'long_tone' ? 'ロングトーン' : 'タンギング';
            return (
              <Controller
                key={type}
                control={control}
                name={fieldName}
                render={({ field: { onChange, onBlur, value } }) => (
                  <YStack gap="$1">
                    <Paragraph color="$color11" fontSize="$3">
                      {label}（分）任意
                    </Paragraph>
                    <Input
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(t) => {
                        const n = Number(t);
                        onChange(t === '' || isNaN(n) ? undefined : n);
                      }}
                      onBlur={onBlur}
                      placeholder="例: 10"
                      keyboardType="numeric"
                      aria-label={ariaLabel}
                    />
                    <FieldError message={errors[fieldName]?.message} />
                  </YStack>
                )}
              />
            );
          })}

          {watchedTonguing !== undefined && (
            <Controller
              control={control}
              name="tonguingTempoBpm"
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack gap="$1">
                  <Paragraph color="$color11" fontSize="$3">
                    テンポ（BPM）任意
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
                    aria-label="タンギング テンポ (BPM)"
                  />
                  <FieldError message={errors.tonguingTempoBpm?.message} />
                </YStack>
              )}
            />
          )}

          {totalMinutes > 0 && (
            <Paragraph fontSize="$2" color="$color10">
              合計: {totalMinutes}分
            </Paragraph>
          )}
        </YStack>

        {/* メモ */}
        <Controller
          control={control}
          name="memo"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">メモ 任意</Paragraph>
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="自由記入"
                multiline
                numberOfLines={3}
                aria-label="メモ"
              />
            </YStack>
          )}
        />

        {/* 教本の進捗 */}
        <YStack gap="$2">
          <Paragraph color="$color12">教本の進捗</Paragraph>

          {fields.map((field, index) => {
            const otherSelectedIds = new Set(
              watchedEntries
                .filter((_, i) => i !== index)
                .map((e) => e.textbookId)
                .filter(Boolean),
            );
            const selectedTextbookId = watchedEntries[index]?.textbookId;
            const selectedTextbook = textbooks.find((tb) => tb.id === selectedTextbookId);

            return (
              <YStack key={field.id} gap="$2" p="$3" bg="$color2" rounded="$3">
                <XStack gap="$2" items="center">
                  <Controller
                    control={control}
                    name={`textbookEntries.${index}.textbookId`}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <YStack flex={1} gap="$1">
                        <Select value={value} onValueChange={onChange}>
                          <Select.Trigger
                            flex={1}
                            onBlur={onBlur}
                            aria-label={`教本を選択 ${index + 1}`}
                          >
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
                        <FieldError
                          message={errors.textbookEntries?.[index]?.textbookId?.message}
                        />
                      </YStack>
                    )}
                  />
                  <Button
                    size="$2"
                    theme="red"
                    onPress={() => remove(index)}
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
                        <XStack gap="$2" items="center">
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
                          {selectedTextbook?.totalPages != null && (
                            <Paragraph fontSize="$2" color="$color10">
                              / {selectedTextbook.totalPages}
                            </Paragraph>
                          )}
                        </XStack>
                      )}
                    />
                  </XStack>
                  <FieldError message={errors.textbookEntries?.[index]?.currentPage?.message} />
                </YStack>
              </YStack>
            );
          })}

          <Button
            onPress={() => append({ textbookId: '', currentPage: 0 })}
            aria-label="教本を追加"
          >
            ＋ 教本を追加
          </Button>
        </YStack>

        <Button theme="blue" onPress={submitForm} disabled={isSubmitting} aria-label="保存">
          保存
        </Button>
      </YStack>
    </ScrollView>
  );
});
