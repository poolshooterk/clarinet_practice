import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { type RecordingChange, RecordingSection } from '@/components/form/recording-section';
import { TimerControl } from '@/components/timer-control';
import {
  BASIC_GENRES,
  BASIC_MENUS,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
import { type SessionRecording, usePracticeLogStore } from '@/store/practice-log';
import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTimerStore } from '@/store/timer';

type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
  initialValues?: PracticeLogInput;
  existingRecordings?: SessionRecording[];
  onDirtyChange?: (dirty: boolean) => void;
  onMoveExisting?: (rec: SessionRecording) => void;
};

export type PracticeLogFormRef = {
  submit: () => void;
  getRecordingChange: () => RecordingChange;
};

type TextbookEntryRowProps = {
  index: number;
  fieldId: string;
  control: Control<PracticeLogInput>;
  errors: FieldErrors<PracticeLogInput>;
  textbooks: Textbook[];
  watchedEntries: PracticeLogInput['textbookEntries'];
  onRemove: () => void;
  setValue: UseFormSetValue<PracticeLogInput>;
};

function TextbookEntryRow({
  index,
  fieldId,
  control,
  errors,
  textbooks,
  watchedEntries,
  onRemove,
  setValue,
}: TextbookEntryRowProps) {
  const {
    fields: bpmFields,
    append: appendBpm,
    remove: removeBpm,
  } = useFieldArray({
    control,
    name: `textbookEntries.${index}.tempoBpms` as `textbookEntries.0.tempoBpms`,
  });

  const otherSelectedIds = new Set(
    watchedEntries
      .filter((_, i) => i !== index)
      .map((e) => e.textbookId)
      .filter(Boolean),
  );
  const selectedTextbookId = watchedEntries[index]?.textbookId;
  const selectedTextbook = textbooks.find((tb) => tb.id === selectedTextbookId);
  const isScale = selectedTextbook?.genre === 'スケール';

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
              <XStack gap="$2" items="center">
                <NumericInput
                  width={64}
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  ariaLabel={`ページ ${index + 1}`}
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

      <TimerControl
        timerKey={`textbook-${fieldId}`}
        label={`教本 ${index + 1}`}
        onStop={(minutes) => setValue(`textbookEntries.${index}.durationMinutes`, minutes)}
      />
      <Controller
        control={control}
        name={`textbookEntries.${index}.durationMinutes`}
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph fontSize="$2" color="$color10">
              練習時間（分）任意
            </Paragraph>
            <NumericInput
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder="例: 15"
              ariaLabel={`教本練習時間 ${index + 1}`}
            />
          </YStack>
        )}
      />
      <FieldError message={errors.textbookEntries?.[index]?.durationMinutes?.message} />

      {isScale && (
        <YStack gap="$2">
          <Paragraph color="$color11" fontSize="$3">
            テンポ（BPM）任意
          </Paragraph>
          {bpmFields.map((bpmField, bpmIndex) => (
            <YStack key={bpmField.id} gap="$1">
              <XStack gap="$2" items="center">
                <Controller
                  control={control}
                  name={
                    `textbookEntries.${index}.tempoBpms.${bpmIndex}.bpm` as `textbookEntries.0.tempoBpms.0.bpm`
                  }
                  render={({ field: { onChange, onBlur, value } }) => (
                    <NumericInput
                      flex={1}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      placeholder="例: 120"
                      ariaLabel={`スケールBPM ${index + 1}-${bpmIndex + 1}`}
                    />
                  )}
                />
                <Button
                  size="$2"
                  theme="red"
                  onPress={() => removeBpm(bpmIndex)}
                  aria-label={`スケールBPM ${index + 1}-${bpmIndex + 1} を削除`}
                >
                  ✕
                </Button>
              </XStack>
              <FieldError
                message={
                  (
                    errors.textbookEntries?.[index]?.tempoBpms as
                      | { bpm?: { message?: string } }[]
                      | undefined
                  )?.[bpmIndex]?.bpm?.message
                }
              />
            </YStack>
          ))}
          <Button
            onPress={() => appendBpm({} as { bpm: number })}
            aria-label={`スケールテンポを追加 ${index + 1}`}
          >
            ＋ テンポを追加
          </Button>
        </YStack>
      )}
    </YStack>
  );
}

export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit, initialValues, existingRecordings = [], onDirtyChange, onMoveExisting },
  ref,
) {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const sessions = usePracticeLogStore((s) => s.sessions);
  const [showPicker, setShowPicker] = useState(false);
  const [recDirty, setRecDirty] = useState(false);

  const recChangeRef = useRef<RecordingChange>({ toAdd: [], toDelete: [] });

  const textbookIds = new Set(textbooks.map((t) => t.id));
  const lastTextbookEntries = (sessions[0]?.textbookEntries ?? [])
    .filter((e) => textbookIds.has(e.textbookId))
    .map((e) => ({ textbookId: e.textbookId, currentPage: e.currentPage }));

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PracticeLogInput>({
    resolver: zodResolver(practiceLogSchema),
    mode: 'onTouched',
    defaultValues: initialValues ?? {
      practicedAt: today(),
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpms: [],
      otherMinutes: undefined,
      otherMemo: '',
      memo: '',
      reedNumber: '',
      textbookEntries: lastTextbookEntries,
    },
  });

  // initialValues が undefined → 定義済みになったときだけ1回 reset する
  // バックグラウンドの再フェッチで参照が差し替わっても上書きしない
  const hasAppliedInitialValues = useRef(false);
  useEffect(() => {
    if (initialValues && !hasAppliedInitialValues.current) {
      hasAppliedInitialValues.current = true;
      reset(initialValues);
    }
  }, [initialValues, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const {
    fields: bpmFields,
    append: appendBpm,
    remove: removeBpm,
  } = useFieldArray({ control, name: 'tonguingTempoBpms' });
  const watchedEntries = watch('textbookEntries') ?? [];
  const watchedLongTone = watch('longToneMinutes');
  const watchedTonguing = useWatch({ control, name: 'tonguingMinutes' });
  const watchedOther = watch('otherMinutes');

  const formBasicMinutes =
    (watchedLongTone ?? 0) +
    (watchedTonguing ?? 0) +
    watchedEntries.reduce((acc, e) => {
      const tb = textbooks.find((t) => t.id === e.textbookId);
      return tb && (BASIC_GENRES as readonly string[]).includes(tb.genre)
        ? acc + (e.durationMinutes ?? 0)
        : acc;
    }, 0);

  const formTextbookMinutes = watchedEntries.reduce((acc, e) => {
    const tb = textbooks.find((t) => t.id === e.textbookId);
    return tb && !(BASIC_GENRES as readonly string[]).includes(tb.genre)
      ? acc + (e.durationMinutes ?? 0)
      : acc;
  }, 0);

  const formNonBasicMinutes = formTextbookMinutes + (watchedOther ?? 0);

  const resetAll = useTimerStore((s) => s.resetAll);
  const timersActive = useTimerStore((s) =>
    Object.values(s.timers).some((t) => t?.status === 'running'),
  );

  // 入力変更・録音変更・タイマー稼働のいずれかがあれば未保存とみなして親へ通知する。
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty || recDirty || timersActive);
  }, [isDirty, recDirty, timersActive]);

  const submitForm = handleSubmit(async (data) => {
    await onSubmit(data);
    resetAll();
  });

  useImperativeHandle(ref, () => ({
    submit: () => {
      const timerState = useTimerStore.getState();
      if (timerState.timers['long_tone']?.status === 'running') {
        setValue('longToneMinutes', timerState.stop('long_tone'));
      }
      if (timerState.timers['tonguing']?.status === 'running') {
        setValue('tonguingMinutes', timerState.stop('tonguing'));
      }
      if (timerState.timers['other']?.status === 'running') {
        setValue('otherMinutes', timerState.stop('other'));
      }
      fields.forEach((field, index) => {
        const key = `textbook-${field.id}`;
        if (timerState.timers[key]?.status === 'running') {
          setValue(`textbookEntries.${index}.durationMinutes`, timerState.stop(key));
        }
      });
      submitForm();
    },
    getRecordingChange: () => recChangeRef.current,
  }));

  return (
    <ScrollView>
      <YStack gap="$4" p="$4">
        {/* 録音 */}
        <RecordingSection
          existingRecordings={existingRecordings}
          onChange={(change) => {
            recChangeRef.current = change;
          }}
          onDirtyChange={setRecDirty}
          onMoveExisting={onMoveExisting}
        />

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

        {/* 基礎練習 */}
        <YStack gap="$2">
          <Paragraph color="$color12">基礎練習</Paragraph>

          {BASIC_MENUS.map(({ type, label }) => {
            const fieldName = type === 'long_tone' ? 'longToneMinutes' : 'tonguingMinutes';
            const ariaLabel = type === 'long_tone' ? 'ロングトーン' : 'タンギング';
            const timerKey = type === 'long_tone' ? 'long_tone' : 'tonguing';
            return (
              <YStack key={type} gap="$1">
                <Paragraph color="$color11" fontSize="$3">
                  {label}（分）任意
                </Paragraph>
                <TimerControl
                  timerKey={timerKey}
                  label={label}
                  onStop={(minutes) => setValue(fieldName, minutes)}
                />
                <Controller
                  control={control}
                  name={fieldName}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <NumericInput
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      placeholder="例: 10"
                      ariaLabel={ariaLabel}
                    />
                  )}
                />
                <FieldError message={errors[fieldName]?.message} />
              </YStack>
            );
          })}

          {watchedTonguing != null && (
            <YStack gap="$2">
              <Paragraph color="$color11" fontSize="$3">
                テンポ（BPM）任意
              </Paragraph>
              {bpmFields.map((field, index) => (
                <YStack key={field.id} gap="$1">
                  <XStack gap="$2" items="center">
                    <Controller
                      control={control}
                      name={`tonguingTempoBpms.${index}.bpm`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <NumericInput
                          flex={1}
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          placeholder="例: 120"
                          ariaLabel={`BPM ${index + 1}`}
                        />
                      )}
                    />
                    <Button
                      size="$2"
                      theme="red"
                      onPress={() => removeBpm(index)}
                      aria-label={`BPM ${index + 1} を削除`}
                    >
                      ✕
                    </Button>
                  </XStack>
                  <FieldError message={errors.tonguingTempoBpms?.[index]?.bpm?.message} />
                </YStack>
              ))}
              <Button onPress={() => appendBpm({} as { bpm: number })} aria-label="テンポを追加">
                ＋ テンポを追加
              </Button>
            </YStack>
          )}

          {(formBasicMinutes > 0 || formNonBasicMinutes > 0) && (
            <YStack gap="$1">
              <Paragraph fontSize="$2" color="$color10">
                {[
                  formBasicMinutes > 0 && `基礎: ${formBasicMinutes}分`,
                  formNonBasicMinutes > 0 && `基礎練習以外: ${formNonBasicMinutes}分`,
                ]
                  .filter(Boolean)
                  .join(' / ')}
              </Paragraph>
              <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
                {`合計: ${formBasicMinutes + formNonBasicMinutes}分`}
              </Paragraph>
            </YStack>
          )}
        </YStack>

        {/* 教本の進捗 */}
        <YStack gap="$2">
          <Paragraph color="$color12">教本の進捗</Paragraph>

          {fields.map((field, index) => (
            <TextbookEntryRow
              key={field.id}
              index={index}
              fieldId={field.id}
              control={control}
              errors={errors}
              textbooks={textbooks}
              watchedEntries={watchedEntries}
              onRemove={() => remove(index)}
              setValue={setValue}
            />
          ))}

          <Button
            onPress={() => append({ textbookId: '', currentPage: 0 })}
            aria-label="教本を追加"
          >
            ＋ 教本を追加
          </Button>
        </YStack>

        {/* その他 */}
        <YStack gap="$2">
          <Paragraph color="$color12">その他</Paragraph>
          <Paragraph color="$color11" fontSize="$3">
            練習時間（分）任意
          </Paragraph>
          <TimerControl
            timerKey="other"
            label="その他"
            onStop={(minutes) => setValue('otherMinutes', minutes)}
          />
          <Controller
            control={control}
            name="otherMinutes"
            render={({ field: { onChange, onBlur, value } }) => (
              <NumericInput
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="例: 20"
                ariaLabel="その他"
              />
            )}
          />
          <FieldError message={errors.otherMinutes?.message} />
          <Paragraph color="$color11" fontSize="$3">
            練習内容（任意）
          </Paragraph>
          <Controller
            control={control}
            name="otherMemo"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="例: 曲の通し練習、アンサンブルなど"
                aria-label="その他練習内容"
              />
            )}
          />
        </YStack>

        <Controller
          control={control}
          name="reedNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">使用リード番号 任意</Paragraph>
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="例: A3、2b など"
                keyboardType="ascii-capable"
                aria-label="使用リード番号"
              />
              <FieldError message={errors.reedNumber?.message} />
            </YStack>
          )}
        />

        <Button theme="blue" onPress={submitForm} disabled={isSubmitting} aria-label="保存">
          保存
        </Button>
      </YStack>
    </ScrollView>
  );
});
