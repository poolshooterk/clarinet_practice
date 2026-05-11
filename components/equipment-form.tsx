import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform, ScrollView } from 'react-native';
import { Button, Card, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  type ClarinetEquipment,
  clarinetEquipmentSchema,
  formatDate,
  parseYmd,
} from '@/forms/equipment';
import { useEquipmentStore } from '@/store/equipment';

type Section = 'instrument' | 'reed' | 'ligature' | 'mouthpiece';

const SECTIONS: {
  key: Section;
  label: string;
  emoji: string;
  placeholder: string;
  presets: string[];
}[] = [
  {
    key: 'instrument',
    label: '楽器',
    emoji: '🎵',
    placeholder: '例: B♭クラリネット',
    presets: ['B♭クラリネット', 'Aクラリネット', 'バスクラリネット', 'Eクラリネット'],
  },
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

const emptyItem = { name: '', startDate: '' };

type Props = {
  onSubmit?: (values: ClarinetEquipment) => void;
};

export function EquipmentForm({ onSubmit }: Props) {
  const setEquipment = useEquipmentStore((s) => s.setEquipment);
  const savedEquipment = useEquipmentStore((s) => s.equipment);
  const [showPicker, setShowPicker] = useState<Section | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClarinetEquipment>({
    resolver: zodResolver(clarinetEquipmentSchema),
    mode: 'onTouched',
    defaultValues: savedEquipment ?? {
      instrument: emptyItem,
      reed: emptyItem,
      ligature: emptyItem,
      mouthpiece: emptyItem,
    },
  });

  const handleSave = (values: ClarinetEquipment) => {
    setEquipment(values);
    if (onSubmit) {
      onSubmit(values);
    } else {
      Alert.alert('保存しました');
    }
  };

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        {SECTIONS.map((section) => (
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
              name={
                `${section.key}.name` as
                  | 'instrument.name'
                  | 'reed.name'
                  | 'ligature.name'
                  | 'mouthpiece.name'
              }
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
                  | 'instrument.startDate'
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
