import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { annualGoalSchema, type AnnualGoalInput } from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function AnnualGoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goals = useAnnualGoalsStore((s) => s.goals);
  const addGoal = useAnnualGoalsStore((s) => s.addGoal);
  const updateGoal = useAnnualGoalsStore((s) => s.updateGoal);
  const removeGoal = useAnnualGoalsStore((s) => s.removeGoal);

  const isEdit = id != null;
  const existing = useMemo(() => goals.find((g) => g.id === id), [goals, id]);
  const defaultValues: AnnualGoalInput = existing
    ? {
        year: existing.year,
        title: existing.title,
        numericTarget: existing.numericTarget,
        numericUnit: existing.numericUnit,
      }
    : { year: new Date().getFullYear(), title: '', numericTarget: null, numericUnit: null };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AnnualGoalInput>({
    resolver: zodResolver(annualGoalSchema),
    mode: 'onTouched',
    defaultValues,
  });

  async function onSubmit(values: AnnualGoalInput) {
    const result = isEdit ? await updateGoal(id!, values) : await addGoal(values);
    if (!result.ok) {
      Alert.alert('保存に失敗しました');
      return;
    }
    router.back();
  }

  function onDelete() {
    if (!isEdit) return;
    Alert.alert('削除しますか？', '関連する月別マイルストーンもすべて削除されます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeGoal(id!);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: isEdit ? '年間目標の編集' : '年間目標の追加' }} />
      <YStack p="$4" gap="$3">
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>タイトル</Paragraph>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: 音色を磨く"
              />
              <FieldError message={errors.title?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="year"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>年</Paragraph>
              <NumericInput
                value={field.value}
                onChange={(v) => field.onChange(v ?? new Date().getFullYear())}
                onBlur={field.onBlur}
              />
              <FieldError message={errors.year?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericTarget"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>年間数値目標 (任意)</Paragraph>
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
                placeholder="例: ページ"
              />
            </YStack>
          )}
        />
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
