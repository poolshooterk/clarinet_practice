import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Button, Input, Label, YStack } from 'tamagui';
import { z } from 'zod';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { type PurchasePlanSavingsInput, purchasePlanSavingsSchema } from '@/forms/purchase-plan';
import { usePurchasePlanStore } from '@/store/purchase-plan';

// RHF が保持するフォーム値の型: amount は入力中に null になり得る
type SavingsFormValues = z.input<typeof purchasePlanSavingsSchema>;

export default function PurchasePlanSavingsFormScreen() {
  const { planId, id } = useLocalSearchParams<{ planId: string; id?: string }>();
  const isEdit = Boolean(id);

  const savings = usePurchasePlanStore((s) => s.savings);
  const addSaving = usePurchasePlanStore((s) => s.addSaving);
  const updateSaving = usePurchasePlanStore((s) => s.updateSaving);
  const removeSaving = usePurchasePlanStore((s) => s.removeSaving);

  const existing = id ? savings.find((s) => s.id === id) : undefined;

  const { control, handleSubmit } = useForm<SavingsFormValues>({
    resolver: zodResolver(purchasePlanSavingsSchema),
    mode: 'onTouched',
    defaultValues: {
      yearMonth: existing?.yearMonth ?? '',
      amount: existing?.amount ?? null,
      memo: existing?.memo ?? null,
    },
  });

  const onSubmit = async (data: SavingsFormValues) => {
    // zodResolver が refine を通過した時点で amount は number に確定している
    await (isEdit && id
      ? updateSaving(id, data as PurchasePlanSavingsInput)
      : addSaving(planId, data as PurchasePlanSavingsInput));
    router.back();
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('削除確認', '貯蓄実績を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeSaving(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isEdit ? '貯蓄実績を編集' : '貯蓄実績を追加',
          headerRight: isEdit
            ? () => (
                <TouchableOpacity
                  onPress={handleDelete}
                  aria-label="削除"
                  style={{ paddingHorizontal: 12 }}
                >
                  <Feather name="trash-2" size={20} color="red" />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <ScrollView>
        <YStack gap="$4" p="$4">
          <YStack gap="$1">
            <Label>年月 (YYYY-MM)</Label>
            <Controller
              control={control}
              name="yearMonth"
              render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                <>
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="例: 2026-05"
                    aria-label="年月"
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </YStack>

          <YStack gap="$1">
            <Label>金額 (円)</Label>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                <>
                  <NumericInput
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    placeholder="例: 30000"
                    ariaLabel="金額"
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </YStack>

          <YStack gap="$1">
            <Label>メモ (任意)</Label>
            <Controller
              control={control}
              name="memo"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  value={value ?? ''}
                  onChangeText={(t) => onChange(t === '' ? null : t)}
                  onBlur={onBlur}
                  placeholder="例: ボーナス"
                  aria-label="メモ"
                />
              )}
            />
          </YStack>

          <Button onPress={handleSubmit(onSubmit)} theme="blue">
            保存
          </Button>

          {isEdit && (
            <Button onPress={handleDelete} theme="red" aria-label="削除" chromeless>
              削除
            </Button>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
