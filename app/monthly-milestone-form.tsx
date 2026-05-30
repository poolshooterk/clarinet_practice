import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import {
  ACHIEVEMENT_LABELS,
  ACHIEVEMENT_VALUES,
  canReviewMilestone,
  type MonthlyMilestoneInput,
  monthlyMilestoneSchema,
} from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function MonthlyMilestoneForm() {
  const { goalId, month, id } = useLocalSearchParams<{
    goalId: string;
    month?: string;
    id?: string;
  }>();
  const goals = useAnnualGoalsStore((s) => s.goals);
  const upsertMilestone = useAnnualGoalsStore((s) => s.upsertMilestone);
  const removeMilestone = useAnnualGoalsStore((s) => s.removeMilestone);
  const reviewMilestone = useAnnualGoalsStore((s) => s.reviewMilestone);

  const goal = useMemo(() => goals.find((g) => g.id === goalId), [goals, goalId]);
  const existing = useMemo(() => {
    if (!goal) return undefined;
    if (id != null) return goal.milestones.find((m) => m.id === id);
    if (month != null) return goal.milestones.find((m) => String(m.month) === month);
    return undefined;
  }, [goal, id, month]);
  const isEdit = existing != null;
  const initialMonth = existing?.month ?? Number(month ?? '1');
  const canReview = goal ? canReviewMilestone(goal.year, initialMonth, new Date()) : false;

  const defaultValues: MonthlyMilestoneInput = existing
    ? {
        month: existing.month,
        text: existing.text,
        numericTarget: existing.numericTarget,
        numericUnit: existing.numericUnit,
        reviewText: existing.reviewText,
        achievement: existing.achievement,
      }
    : {
        month: initialMonth,
        text: '',
        numericTarget: null,
        numericUnit: null,
        reviewText: null,
        achievement: null,
      };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MonthlyMilestoneInput>({
    resolver: zodResolver(monthlyMilestoneSchema),
    mode: 'onTouched',
    defaultValues,
  });

  async function onSubmit(values: MonthlyMilestoneInput) {
    if (!goalId) return;
    const upsertResult = await upsertMilestone(goalId, values);
    if (!upsertResult.ok) {
      Alert.alert('保存に失敗しました');
      return;
    }
    if (canReview && values.achievement != null) {
      const milestoneId = upsertResult.milestoneId ?? existing?.id;
      if (milestoneId) {
        const reviewResult = await reviewMilestone(milestoneId, {
          reviewText: values.reviewText ?? null,
          achievement: values.achievement,
        });
        if (!reviewResult.ok) {
          Alert.alert('振り返りの保存に失敗しました');
          return;
        }
      }
    }
    router.back();
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert('削除しますか？', '', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeMilestone(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEdit ? `${initialMonth}月のマイルストーン編集` : 'マイルストーン追加',
        }}
      />
      <YStack p="$4" gap="$3">
        <Controller
          control={control}
          name="month"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>月 (1-12)</Paragraph>
              <NumericInput
                value={field.value}
                onChange={(v) => field.onChange(v ?? 1)}
                onBlur={field.onBlur}
              />
              <FieldError message={errors.month?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="text"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>マイルストーン</Paragraph>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: ロングトーン強化"
              />
              <FieldError message={errors.text?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericTarget"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>数値目標 (任意)</Paragraph>
              <NumericInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericUnit"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>単位 (任意)</Paragraph>
              <Input
                value={field.value ?? ''}
                onChangeText={(v) => field.onChange(v || null)}
                onBlur={field.onBlur}
              />
            </YStack>
          )}
        />
        {canReview && (
          <YStack gap="$2" mt="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
            <Paragraph fontWeight="bold">振り返り</Paragraph>
            <Controller
              control={control}
              name="achievement"
              render={({ field }) => (
                <XStack gap="$2">
                  {ACHIEVEMENT_VALUES.map((v) => (
                    <Button
                      key={v}
                      size="$2"
                      theme={field.value === v ? 'blue' : undefined}
                      onPress={() => field.onChange(field.value === v ? null : v)}
                    >
                      {ACHIEVEMENT_LABELS[v]}
                    </Button>
                  ))}
                </XStack>
              )}
            />
            <Controller
              control={control}
              name="reviewText"
              render={({ field }) => (
                <Input
                  value={field.value ?? ''}
                  onChangeText={(v) => field.onChange(v || null)}
                  onBlur={field.onBlur}
                  placeholder="振り返りコメント"
                  multiline
                  numberOfLines={3}
                />
              )}
            />
          </YStack>
        )}
        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting} theme="blue">
          保存
        </Button>
        {isEdit && (
          <Button onPress={onDelete} theme="red">
            削除
          </Button>
        )}
      </YStack>
    </>
  );
}
