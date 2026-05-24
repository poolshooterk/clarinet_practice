import { zodResolver } from '@hookform/resolvers/zod';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Button, Card, Paragraph, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { InstrumentPicker } from '@/components/instrument-picker';
import { calcPurchaseDate, type PurchasePlan, purchasePlanSchema } from '@/forms/purchase-plan';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';

// RHF が保持するフォーム値の型: targetPrice / monthlyTarget は入力中に null になり得る
type PurchasePlanFormValues = z.input<typeof purchasePlanSchema>;

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

export function PurchasePlanForm() {
  const fetchAllPlan = usePurchasePlanStore((s) => s.fetchAll);
  const fetchAllCatalog = useInstrumentCatalogStore((s) => s.fetchAll);
  const plan = usePurchasePlanStore((s) => s.plan);
  const savings = usePurchasePlanStore((s) => s.savings);
  const upsertPlan = usePurchasePlanStore((s) => s.upsertPlan);

  useFocusEffect(
    useCallback(() => {
      fetchAllPlan();
      fetchAllCatalog();
    }, [fetchAllPlan, fetchAllCatalog]),
  );

  const [isEditing, setIsEditing] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchasePlanFormValues>({
    resolver: zodResolver(purchasePlanSchema),
    mode: 'onTouched',
    defaultValues: {
      makerId: '',
      makerName: '',
      modelId: '',
      modelName: '',
      targetPrice: null,
      monthlyTarget: null,
    },
  });

  useEffect(() => {
    if (plan) {
      reset({
        makerId: plan.makerId,
        makerName: plan.makerName,
        modelId: plan.modelId,
        modelName: plan.modelName,
        targetPrice: plan.targetPrice,
        monthlyTarget: plan.monthlyTarget,
      });
    }
  }, [plan, reset]);

  const [makerId, makerName, modelId, modelName] = watch([
    'makerId',
    'makerName',
    'modelId',
    'modelName',
  ]);

  const showEditForm = !plan || isEditing;

  const onSubmitPlan = async (data: PurchasePlanFormValues) => {
    // zodResolver が refine を通過した時点で targetPrice / monthlyTarget は number に確定
    await upsertPlan(data as PurchasePlan);
    setIsEditing(false);
  };

  const totalSavings = savings.reduce((sum, s) => sum + s.amount, 0);
  const progressPct =
    plan && plan.targetPrice > 0 ? Math.min(totalSavings / plan.targetPrice, 1) : 0;
  const purchaseDateResult = plan
    ? calcPurchaseDate(plan.targetPrice, totalSavings, plan.monthlyTarget)
    : null;

  // 当月・前月の実績を表示（yearMonth の降順）
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const recentMonths = [currentYM, prevYM];
  const sortedSavings = [...savings].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  const recentSavings = sortedSavings.filter((s) => recentMonths.includes(s.yearMonth));
  const hasOlderEntries = savings.some((s) => !recentMonths.includes(s.yearMonth));

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        {/* 計画カード */}
        <Card elevation="$2" borderWidth={1} borderColor="$blue8" bg="$blue2" p="$4" gap="$3">
          <Paragraph size="$5" fontWeight="bold" color="$blue11">
            欲しい楽器
          </Paragraph>

          {!showEditForm && plan ? (
            // 閲覧モード
            <YStack gap="$2">
              <Paragraph color="$blue12" fontWeight="bold">
                {plan.makerName}　{plan.modelName}
              </Paragraph>
              <Paragraph color="$blue11">目標金額: ¥{plan.targetPrice.toLocaleString()}</Paragraph>
              <Paragraph color="$blue11">
                月額目標: ¥{plan.monthlyTarget.toLocaleString()}/月
              </Paragraph>
              <Button
                size="$3"
                theme="blue"
                onPress={() => setIsEditing(true)}
                aria-label="計画を編集"
              >
                編集
              </Button>
            </YStack>
          ) : (
            // 編集モード
            <YStack gap="$3">
              <InstrumentPicker
                value={makerId ? { makerId, makerName, modelId, modelName } : null}
                onChange={(v) => {
                  setValue('makerId', v.makerId, { shouldValidate: true });
                  setValue('makerName', v.makerName, { shouldValidate: true });
                  setValue('modelId', v.modelId, { shouldValidate: true });
                  setValue('modelName', v.modelName, { shouldValidate: true });
                }}
              />
              <FieldError message={errors.makerId?.message} />
              <FieldError message={errors.modelId?.message} />

              <YStack gap="$1">
                <Paragraph color="$blue11">目標金額（円）</Paragraph>
                <Controller
                  control={control}
                  name="targetPrice"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <NumericInput
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      placeholder="例: 850000"
                      ariaLabel="目標金額"
                    />
                  )}
                />
                <FieldError message={errors.targetPrice?.message} />
              </YStack>

              <YStack gap="$1">
                <Paragraph color="$blue11">予定月額（円）</Paragraph>
                <Controller
                  control={control}
                  name="monthlyTarget"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <NumericInput
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      placeholder="例: 30000"
                      ariaLabel="予定月額"
                    />
                  )}
                />
                <FieldError message={errors.monthlyTarget?.message} />
              </YStack>

              <XStack gap="$2">
                <Button
                  flex={1}
                  theme="blue"
                  onPress={handleSubmit(onSubmitPlan)}
                  aria-label="計画を保存"
                >
                  保存
                </Button>
                {plan && (
                  <Button
                    flex={1}
                    variant="outlined"
                    onPress={() => setIsEditing(false)}
                    aria-label="編集をキャンセル"
                  >
                    キャンセル
                  </Button>
                )}
              </XStack>
            </YStack>
          )}
        </Card>

        {/* 進捗カード */}
        {plan && (
          <Card elevation="$2" borderWidth={1} borderColor="$green8" bg="$green2" p="$4" gap="$3">
            <Paragraph size="$5" fontWeight="bold" color="$green11">
              貯蓄進捗
            </Paragraph>
            <Paragraph color="$green12" size="$6" fontWeight="bold">
              ¥{totalSavings.toLocaleString()}
            </Paragraph>
            <XStack height={8} rounded="$2" overflow="hidden" bg="$green4">
              <YStack
                height={8}
                width={`${Math.min(Math.round(progressPct * 100), 100)}%`}
                bg="$green9"
              />
            </XStack>
            <Paragraph color="$green11" size="$3">
              購入可能時期（自動算出）:{' '}
              {purchaseDateResult ? purchaseDateResult.yearMonth : '未設定'}
            </Paragraph>
            <Paragraph color="$green10" size="$3">
              残り: ¥{Math.max(0, plan.targetPrice - totalSavings).toLocaleString()}
            </Paragraph>
          </Card>
        )}

        {/* 貯蓄実績カード */}
        {plan && (
          <Card elevation="$2" borderWidth={1} borderColor="$orange8" bg="$orange2" p="$4" gap="$3">
            <XStack justify="space-between" items="center">
              <Paragraph size="$5" fontWeight="bold" color="$orange11">
                貯蓄実績
              </Paragraph>
              <Button
                size="$3"
                theme="orange"
                onPress={() =>
                  router.push({
                    pathname: '/purchase-plan-savings-form',
                    params: { planId: plan.id },
                  })
                }
                aria-label="貯蓄実績を追加"
              >
                追加
              </Button>
            </XStack>

            {recentSavings.length === 0 ? (
              <Paragraph color="$orange10" size="$3">
                貯蓄実績がありません
              </Paragraph>
            ) : (
              <>
                {recentSavings.map((entry) => (
                  <XStack
                    key={entry.id}
                    justify="space-between"
                    items="flex-start"
                    borderTopWidth={1}
                    borderColor="$orange4"
                    pt="$2"
                  >
                    <YStack flex={1}>
                      <Paragraph color="$orange12">
                        {formatYearMonth(entry.yearMonth)}　¥{entry.amount.toLocaleString()}
                        {entry.memo ? `　${entry.memo}` : ''}
                      </Paragraph>
                    </YStack>
                    <Button
                      size="$2"
                      chromeless
                      onPress={() =>
                        router.push({
                          pathname: '/purchase-plan-savings-form',
                          params: { planId: plan.id, id: entry.id },
                        })
                      }
                      aria-label={`${entry.yearMonth} の実績を編集`}
                    >
                      編集
                    </Button>
                  </XStack>
                ))}
                {hasOlderEntries && (
                  <Paragraph color="$orange10" size="$2">
                    （それ以前の記録は非表示）
                  </Paragraph>
                )}
              </>
            )}
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
