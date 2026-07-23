import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, Select, TextArea, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  HOMEWORK_STATUS_LABELS,
  HOMEWORK_STATUS_VALUES,
  type HomeworkInput,
  homeworkSchema,
} from '@/forms/homework';
import { formatDate } from '@/forms/lesson-record';
import { type Homework, useLessonRecordStore } from '@/store/lesson-record';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

// 外側: params 解決 + スナップショット確定。RHF を持つ本体 (HomeworkFormBody) は
// existing が確定してからマウントするため、defaultValues が常に正しい
// (edit モードで records 未取得の初回に空 default で初期化される RHF バグを避ける)。
export default function HomeworkForm() {
  const { lessonRecordId, id } = useLocalSearchParams<{ lessonRecordId?: string; id?: string }>();
  const records = useLessonRecordStore((s) => s.records);

  useFocusEffect(
    useCallback(() => {
      useTextbookCatalogStore.getState().fetchAll();
      useLessonRecordStore.getState().fetchAll();
    }, []),
  );

  // 開いた時点の宿題を一度だけ固定する (保存後の再解決でモード反転→クラッシュを避ける)。
  const snapshotRef = useRef<{ existing: Homework | undefined } | null>(null);
  if (snapshotRef.current === null) {
    if (id == null) {
      snapshotRef.current = { existing: undefined };
    } else {
      const ex = records.flatMap((r) => r.homework).find((h) => h.id === id);
      if (ex) snapshotRef.current = { existing: ex };
    }
  }

  // 編集モードで宿題がまだ取得できていない (records 未ロード) 場合はローディング表示。
  if (snapshotRef.current === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '宿題を編集' }} />
        <YStack p="$4">
          <Paragraph>読み込み中...</Paragraph>
        </YStack>
      </>
    );
  }

  return (
    <HomeworkFormBody existing={snapshotRef.current.existing} lessonRecordId={lessonRecordId} />
  );
}

type BodyProps = { existing: Homework | undefined; lessonRecordId?: string };

function HomeworkFormBody({ existing, lessonRecordId }: BodyProps) {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const addHomework = useLessonRecordStore((s) => s.addHomework);
  const updateHomework = useLessonRecordStore((s) => s.updateHomework);
  const removeHomework = useLessonRecordStore((s) => s.removeHomework);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isEdit = existing != null;

  const defaultValues: HomeworkInput = existing
    ? {
        content: existing.content,
        dueDate: existing.dueDate ?? '',
        textbookId: existing.textbookId ?? '',
        reviewNote: existing.reviewNote ?? '',
        status: existing.status,
      }
    : { content: '', dueDate: '', textbookId: '', reviewNote: '', status: 'not_started' };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HomeworkInput>({
    resolver: zodResolver(homeworkSchema),
    mode: 'onTouched',
    defaultValues,
  });

  async function onSubmit(values: HomeworkInput) {
    const result = isEdit
      ? await updateHomework(existing!.id, values)
      : lessonRecordId
        ? await addHomework(lessonRecordId, values)
        : ({ ok: false, reason: 'unknown' } as const);
    if (!result.ok) {
      Alert.alert('保存に失敗しました');
      return;
    }
    router.back();
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert('宿題を削除しますか？', '', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeHomework(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: isEdit ? '宿題を編集' : '宿題を追加' }} />
      <YStack p="$4" gap="$3">
        <Controller
          control={control}
          name="content"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>内容 *</Paragraph>
              <TextArea
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: ロングトーンを毎日10分"
                numberOfLines={3}
                aria-label="宿題の内容"
              />
              <FieldError message={errors.content?.message} />
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>進捗</Paragraph>
              <XStack gap="$2">
                {HOMEWORK_STATUS_VALUES.map((v) => (
                  <Button
                    key={v}
                    size="$2"
                    theme={field.value === v ? 'blue' : undefined}
                    onPress={() => field.onChange(v)}
                    aria-label={`ステータス ${HOMEWORK_STATUS_LABELS[v]}`}
                  >
                    {HOMEWORK_STATUS_LABELS[v]}
                  </Button>
                ))}
              </XStack>
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="dueDate"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph>期限 (任意)</Paragraph>
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="YYYY-MM-DD"
                aria-label="宿題の期限"
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
              <FieldError message={errors.dueDate?.message} />
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="textbookId"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph>関連教本 (任意)</Paragraph>
              <Select value={value ?? ''} onValueChange={onChange}>
                <Select.Trigger onBlur={onBlur} aria-label="関連教本を選択">
                  <Select.Value placeholder="教本を選択" />
                </Select.Trigger>
                <Select.Content>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    {textbooks.map((tb, i) => (
                      <Select.Item key={tb.id} index={i} value={tb.id}>
                        <Select.ItemText>{tb.title}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="reviewNote"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph>振り返りメモ (任意)</Paragraph>
              <TextArea
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="取り組んだ結果など"
                numberOfLines={3}
                aria-label="宿題の振り返りメモ"
              />
            </YStack>
          )}
        />

        <Button
          theme="blue"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          aria-label="保存"
        >
          保存
        </Button>
        {isEdit && (
          <Button theme="red" onPress={onDelete}>
            削除
          </Button>
        )}
      </YStack>
    </>
  );
}
