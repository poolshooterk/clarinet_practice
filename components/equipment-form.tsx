import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform, ScrollView } from 'react-native';
import { Button, Card, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { InstrumentPicker } from '@/components/instrument-picker';
import {
  type ClarinetEquipment,
  clarinetEquipmentSchema,
  formatDate,
  parseYmd,
} from '@/forms/equipment';
import { useEquipmentStore } from '@/store/equipment';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

type OtherSection = 'reed' | 'ligature' | 'mouthpiece';

const OTHER_SECTIONS: {
  key: OtherSection;
  label: string;
  emoji: string;
  placeholder: string;
  presets: string[];
}[] = [
  {
    key: 'reed',
    label: 'リード',
    emoji: '🌿',
    placeholder: '例: Vandoren V12',
    presets: [
      'Vandoren V12',
      'Vandoren Traditional（青箱）',
      'Vandoren V21',
      "D'Addario Select Jazz",
      'Rico Royal',
      'Legere Signature',
    ],
  },
  {
    key: 'ligature',
    label: 'リガチャー',
    emoji: '🔗',
    placeholder: '例: Vandoren M/O',
    presets: ['Vandoren M/O', 'BG Franck Superior', 'Bonade', 'Rovner Dark', 'Harrison'],
  },
  {
    key: 'mouthpiece',
    label: 'マウスピース',
    emoji: '🎤',
    placeholder: '例: Vandoren B45',
    presets: ['Vandoren B45', 'Vandoren M30', 'Vandoren BD5', 'Clark W. Fobes Debut', 'Selmer C85'],
  },
];

const emptyInstrument = {
  makerId: '',
  makerName: '',
  modelId: '',
  modelName: '',
  startDate: '',
};
const emptyItem = { name: '', startDate: '' };

const defaultOnSubmit = (_values: ClarinetEquipment) => {
  Alert.alert('保存しました');
};

type Props = {
  onSubmit?: (values: ClarinetEquipment) => void;
};

export function EquipmentForm({ onSubmit = defaultOnSubmit }: Props) {
  const setEquipment = useEquipmentStore((s) => s.setEquipment);
  const savedEquipment = useEquipmentStore((s) => s.equipment);
  const fetchAll = useInstrumentCatalogStore((s) => s.fetchAll);
  const [showPicker, setShowPicker] = useState<OtherSection | null>(null);
  const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClarinetEquipment>({
    resolver: zodResolver(clarinetEquipmentSchema),
    mode: 'onTouched',
    defaultValues: savedEquipment ?? {
      instrument: emptyInstrument,
      reed: emptyItem,
      ligature: emptyItem,
      mouthpiece: emptyItem,
    },
  });

  const instrumentValue = watch('instrument');

  const handleSave = (values: ClarinetEquipment) => {
    setEquipment(values);
    onSubmit(values);
  };

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        <Card elevation="$2" borderWidth={1} borderColor="$borderColor" p="$4" gap="$3">
          <Paragraph size="$5" fontWeight="bold">
            🎵 楽器
          </Paragraph>

          <InstrumentPicker
            value={
              instrumentValue?.makerId
                ? {
                    makerId: instrumentValue.makerId,
                    makerName: instrumentValue.makerName,
                    modelId: instrumentValue.modelId,
                    modelName: instrumentValue.modelName,
                  }
                : null
            }
            onChange={(v) => {
              setValue('instrument.makerId', v.makerId, { shouldValidate: true });
              setValue('instrument.makerName', v.makerName, { shouldValidate: true });
              setValue('instrument.modelId', v.modelId, { shouldValidate: true });
              setValue('instrument.modelName', v.modelName, { shouldValidate: true });
            }}
          />
          <FieldError message={errors.instrument?.makerId?.message} />
          <FieldError message={errors.instrument?.modelId?.message} />

          <Controller
            control={control}
            name="instrument.purchasePrice"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">購入金額（任意）</Paragraph>
                <Input
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={(t) => {
                    if (t === '') {
                      onChange(undefined);
                      return;
                    }
                    const n = Number(t);
                    onChange(Number.isNaN(n) ? undefined : n);
                  }}
                  onBlur={onBlur}
                  placeholder="例: 850000"
                  keyboardType="numeric"
                  aria-label="購入金額"
                />
              </YStack>
            )}
          />

          <Controller
            control={control}
            name="instrument.startDate"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">使用開始日</Paragraph>
                <XStack gap="$2" items="center">
                  <Input
                    flex={1}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                    aria-label="楽器使用開始日"
                  />
                  {Platform.OS !== 'web' && (
                    <Button
                      onPress={() => setShowInstrumentPicker(true)}
                      aria-label="楽器カレンダーから選択"
                    >
                      📅
                    </Button>
                  )}
                </XStack>
                {showInstrumentPicker && Platform.OS !== 'web' && (
                  <DateTimePicker
                    mode="date"
                    display="default"
                    value={parseYmd(value) ?? new Date()}
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowInstrumentPicker(false);
                      if (event.type === 'set' && selectedDate) {
                        onChange(formatDate(selectedDate));
                      }
                    }}
                  />
                )}
                <FieldError message={errors.instrument?.startDate?.message} />
              </YStack>
            )}
          />
        </Card>

        {OTHER_SECTIONS.map((section) => (
          <Card
            key={section.key}
            elevation="$2"
            borderWidth={1}
            borderColor="$borderColor"
            p="$4"
            gap="$3"
          >
            <Paragraph size="$5" fontWeight="bold">
              {section.emoji} {section.label}
            </Paragraph>

            <Controller
              control={control}
              name={`${section.key}.name` as 'reed.name' | 'ligature.name' | 'mouthpiece.name'}
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack gap="$2">
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={section.placeholder}
                    aria-label={`${section.label}名`}
                  />
                  <XStack flexWrap="wrap" gap="$2">
                    {section.presets.map((preset) => (
                      <Button
                        key={preset}
                        size="$2"
                        variant="outlined"
                        onPress={() => onChange(preset)}
                        aria-label={preset}
                      >
                        {preset}
                      </Button>
                    ))}
                  </XStack>
                  <FieldError message={errors[section.key]?.name?.message} />
                </YStack>
              )}
            />

            <Controller
              control={control}
              name={
                `${section.key}.startDate` as
                  | 'reed.startDate'
                  | 'ligature.startDate'
                  | 'mouthpiece.startDate'
              }
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack gap="$1">
                  <Paragraph color="$color12">使用開始日</Paragraph>
                  <XStack gap="$2" items="center">
                    <Input
                      flex={1}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                      aria-label={`${section.label}使用開始日`}
                    />
                    {Platform.OS !== 'web' && (
                      <Button
                        onPress={() => setShowPicker(section.key)}
                        aria-label={`${section.label}カレンダーから選択`}
                      >
                        📅
                      </Button>
                    )}
                  </XStack>
                  {showPicker === section.key && Platform.OS !== 'web' && (
                    <DateTimePicker
                      mode="date"
                      display="default"
                      value={parseYmd(value) ?? new Date()}
                      maximumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        setShowPicker(null);
                        if (event.type === 'set' && selectedDate) {
                          onChange(formatDate(selectedDate));
                        }
                      }}
                    />
                  )}
                  <FieldError message={errors[section.key]?.startDate?.message} />
                </YStack>
              )}
            />
          </Card>
        ))}

        <Button theme="blue" onPress={handleSubmit(handleSave)} disabled={isSubmitting}>
          保存する
        </Button>
      </YStack>
    </ScrollView>
  );
}
