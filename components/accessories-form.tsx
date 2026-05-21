import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';
import { z } from 'zod';

import { FieldError } from '@/components/form/field-error';
import {
  calcUsagePeriod,
  type ClarinetEquipment,
  equipmentItemSchema,
  formatDate,
  parseYmd,
} from '@/forms/equipment';
import { useEquipmentStore } from '@/store/equipment';

const accessoriesSchema = z.object({
  reed: equipmentItemSchema,
  ligature: equipmentItemSchema,
  mouthpiece: equipmentItemSchema,
});

type AccessoriesInput = z.infer<typeof accessoriesSchema>;

type Section = 'reed' | 'ligature' | 'mouthpiece';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'reed', label: 'リード' },
  { key: 'ligature', label: 'リガチャー' },
  { key: 'mouthpiece', label: 'マウスピース' },
];

const emptyItem = { name: '', startDate: '' };

export function AccessoriesForm() {
  const fetchEquipment = useEquipmentStore((s) => s.fetchEquipment);
  const saveEquipment = useEquipmentStore((s) => s.saveEquipment);
  const equipment = useEquipmentStore((s) => s.equipment);
  const loaded = useEquipmentStore((s) => s.loaded);
  const [showPicker, setShowPicker] = useState<Section | null>(null);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccessoriesInput>({
    resolver: zodResolver(accessoriesSchema),
    mode: 'onTouched',
    defaultValues: {
      reed: equipment?.reed ?? emptyItem,
      ligature: equipment?.ligature ?? emptyItem,
      mouthpiece: equipment?.mouthpiece ?? emptyItem,
    },
  });

  const hasResetRef = useRef(equipment != null);
  useEffect(() => {
    if (equipment && !hasResetRef.current) {
      reset({
        reed: equipment.reed,
        ligature: equipment.ligature,
        mouthpiece: equipment.mouthpiece,
      });
      hasResetRef.current = true;
    }
  }, [equipment, reset]);

  const reedStartDate = watch('reed.startDate');
  const ligatureStartDate = watch('ligature.startDate');
  const mouthpieceStartDate = watch('mouthpiece.startDate');
  const startDates: Record<Section, string> = {
    reed: reedStartDate,
    ligature: ligatureStartDate,
    mouthpiece: mouthpieceStartDate,
  };

  if (!loaded) {
    return (
      <YStack flex={1} items="center" justify="center" p="$4">
        <Paragraph>読み込み中...</Paragraph>
      </YStack>
    );
  }

  if (!equipment) {
    return (
      <YStack flex={1} p="$4" gap="$3">
        <Paragraph>楽器情報が未登録です。機材タブで楽器を先に登録してください。</Paragraph>
      </YStack>
    );
  }

  const handleSave = async (values: AccessoriesInput) => {
    const fullEquipment: ClarinetEquipment = {
      instrument: equipment.instrument,
      ...values,
    };
    const result = await saveEquipment(fullEquipment);
    if (result.ok) {
      Alert.alert('保存しました');
    } else {
      Alert.alert('保存に失敗しました');
    }
  };

  return (
    <YStack gap="$4" p="$4">
      {SECTIONS.map(({ key, label }) => (
        <YStack key={key} gap="$2">
          <Paragraph color="$color12" fontWeight="bold">
            {label}
          </Paragraph>

          <Controller
            control={control}
            name={`${key}.name`}
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph fontSize="$3" color="$color11">
                  名前 *
                </Paragraph>
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="例: Vandoren V12"
                  aria-label={`${label}名`}
                />
                <FieldError message={errors[key]?.name?.message} />
              </YStack>
            )}
          />

          <Controller
            control={control}
            name={`${key}.startDate`}
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph fontSize="$3" color="$color11">
                  使用開始日 *
                </Paragraph>
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  aria-label={`${label}開始日`}
                />
                {Platform.OS !== 'web' && (
                  <Button size="$2" onPress={() => setShowPicker(key)}>
                    カレンダーで選択
                  </Button>
                )}
                {showPicker === key && Platform.OS !== 'web' && (
                  <DateTimePicker
                    mode="date"
                    value={parseYmd(value) ?? new Date()}
                    onChange={(_, d) => {
                      setShowPicker(null);
                      if (d) onChange(formatDate(d));
                    }}
                  />
                )}
                {startDates[key] && (
                  <Paragraph fontSize="$2" color="$color10">
                    使用期間: {calcUsagePeriod(startDates[key]) ?? '—'}
                  </Paragraph>
                )}
                <FieldError message={errors[key]?.startDate?.message} />
              </YStack>
            )}
          />
        </YStack>
      ))}

      <Button theme="blue" onPress={handleSubmit(handleSave)} disabled={isSubmitting}>
        保存
      </Button>
    </YStack>
  );
}
