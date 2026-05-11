import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Card, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { InstrumentPicker } from '@/components/instrument-picker';
import { calcPurchaseDate, type PurchasePlan, purchasePlanSchema } from '@/forms/purchase-plan';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';

export function PurchasePlanForm() {
  const fetchAll = useInstrumentCatalogStore((s) => s.fetchAll);
  const setPlan = usePurchasePlanStore((s) => s.setPlan);
  const savedPlan = usePurchasePlanStore((s) => s.plan);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const {
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchasePlan>({
    resolver: zodResolver(purchasePlanSchema),
    mode: 'onChange',
    defaultValues: savedPlan ?? {
      makerId: '',
      makerName: '',
      modelId: '',
      modelName: '',
      targetPrice: undefined,
      currentSavings: undefined,
      monthlySavings: undefined,
    },
  });

  const [makerId, makerName, modelId, modelName, targetPrice, currentSavings, monthlySavings] =
    watch([
      'makerId',
      'makerName',
      'modelId',
      'modelName',
      'targetPrice',
      'currentSavings',
      'monthlySavings',
    ]);

  useEffect(() => {
    if (makerId && modelId && targetPrice && currentSavings !== undefined && monthlySavings) {
      const candidate = {
        makerId,
        makerName,
        modelId,
        modelName,
        targetPrice,
        currentSavings,
        monthlySavings,
      };
      const result = purchasePlanSchema.safeParse(candidate);
      if (result.success) {
        setPlan(result.data);
      }
    }
  }, [
    makerId,
    makerName,
    modelId,
    modelName,
    targetPrice,
    currentSavings,
    monthlySavings,
    setPlan,
  ]);

  const values = {
    makerId,
    makerName,
    modelId,
    modelName,
    targetPrice,
    currentSavings,
    monthlySavings,
  };

  const result =
    targetPrice && currentSavings !== undefined && monthlySavings
      ? calcPurchaseDate(targetPrice, currentSavings, monthlySavings)
      : null;

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        <Card elevation="$2" borderWidth={1} borderColor="$borderColor" p="$4" gap="$3">
          <Paragraph size="$5" fontWeight="bold">
            欲しい楽器
          </Paragraph>

          <InstrumentPicker
            value={
              values.makerId
                ? {
                    makerId: values.makerId,
                    makerName: values.makerName,
                    modelId: values.modelId,
                    modelName: values.modelName,
                  }
                : null
            }
            onChange={(v) => {
              setValue('makerId', v.makerId, { shouldValidate: true });
              setValue('makerName', v.makerName, { shouldValidate: true });
              setValue('modelId', v.modelId, { shouldValidate: true });
              setValue('modelName', v.modelName, { shouldValidate: true });
            }}
          />
          <FieldError message={errors.makerId?.message} />
          <FieldError message={errors.modelId?.message} />

          <Controller
            control={control}
            name="targetPrice"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">目標金額</Paragraph>
                <Input
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={(t) => onChange(t === '' ? undefined : (Number(t) ?? undefined))}
                  onBlur={onBlur}
                  placeholder="例: 850000"
                  keyboardType="numeric"
                  aria-label="目標金額"
                />
                <FieldError message={errors.targetPrice?.message} />
              </YStack>
            )}
          />

          <XStack gap="$3">
            <Controller
              control={control}
              name="currentSavings"
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack flex={1} gap="$1">
                  <Paragraph color="$color12">現在の貯蓄額</Paragraph>
                  <Input
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={(t) => onChange(t === '' ? undefined : (Number(t) ?? undefined))}
                    onBlur={onBlur}
                    placeholder="例: 200000"
                    keyboardType="numeric"
                    aria-label="現在の貯蓄額"
                  />
                  <FieldError message={errors.currentSavings?.message} />
                </YStack>
              )}
            />

            <Controller
              control={control}
              name="monthlySavings"
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack flex={1} gap="$1">
                  <Paragraph color="$color12">月の貯蓄額</Paragraph>
                  <Input
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={(t) => onChange(t === '' ? undefined : (Number(t) ?? undefined))}
                    onBlur={onBlur}
                    placeholder="例: 30000"
                    keyboardType="numeric"
                    aria-label="月の貯蓄額"
                  />
                  <FieldError message={errors.monthlySavings?.message} />
                </YStack>
              )}
            />
          </XStack>
        </Card>

        {result && (
          <Card
            elevation="$2"
            borderWidth={1}
            borderColor="$green8"
            backgroundColor="$green2"
            p="$4"
            gap="$2"
          >
            <Paragraph color="$green11" size="$3">
              購入可能時期（自動算出）
            </Paragraph>
            <Paragraph color="$green12" size="$6" fontWeight="bold">
              {result.yearMonth}
            </Paragraph>
            {result.months > 0 && (
              <Paragraph color="$green10" size="$2">
                あと約{result.months}ヶ月・残り￥
                {((values.targetPrice ?? 0) - (values.currentSavings ?? 0)).toLocaleString()}
              </Paragraph>
            )}
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
