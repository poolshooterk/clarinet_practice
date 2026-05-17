import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, ScrollView } from 'react-native';
import { Button, Card, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { InstrumentPicker } from '@/components/instrument-picker';
import {
  calcUsagePeriod,
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
    presets: [
      'Vandoren Optimum',
      'Vandoren M/O',
      'BG Franck Superior',
      'Bonade',
      'Rovner Dark',
      'Harrison',
    ],
  },
  {
    key: 'mouthpiece',
    label: 'マウスピース',
    emoji: '🎤',
    placeholder: '例: Vandoren B45',
    presets: [
      'Vandoren 5RV Lyre',
      'Vandoren B45',
      'Vandoren M30',
      'Vandoren BD5',
      'Clark W. Fobes Debut',
      'Selmer C85',
    ],
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
  const instrumentUsagePeriod = calcUsagePeriod(instrumentValue?.startDate ?? '');
  const photoUri = watch('instrument.photoUri');

  const reedStartDate = watch('reed.startDate');
  const ligatureStartDate = watch('ligature.startDate');
  const mouthpieceStartDate = watch('mouthpiece.startDate');

  const sectionUsagePeriods: Record<string, string | null> = {
    reed: calcUsagePeriod(reedStartDate ?? ''),
    ligature: calcUsagePeriod(ligatureStartDate ?? ''),
    mouthpiece: calcUsagePeriod(mouthpieceStartDate ?? ''),
  };

  const savePhoto = async (tempUri: string) => {
    if (photoUri) {
      try {
        new File(photoUri).delete();
      } catch {}
    }
    const src = new File(tempUri);
    const ext = src.name.includes('.') ? src.name.slice(src.name.lastIndexOf('.')) : '';
    const uniqueName = `photo_${Date.now()}${ext}`;
    const dest = new File(Paths.document, uniqueName);
    src.copy(dest);
    setValue('instrument.photoUri', dest.uri, { shouldValidate: true });
  };

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('カメラへのアクセスが必要です', 'システム設定で許可してください');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        await savePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert('エラー', '写真の保存に失敗しました');
    }
  };

  const handleLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('写真ライブラリへのアクセスが必要です', 'システム設定で許可してください');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!result.canceled) {
        await savePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert('エラー', '写真の保存に失敗しました');
    }
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['キャンセル', 'カメラで撮影', 'ライブラリから選択'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) handleCamera();
          if (index === 2) handleLibrary();
        },
      );
    } else {
      Alert.alert('写真を選択', undefined, [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'カメラで撮影', onPress: handleCamera },
        { text: 'ライブラリから選択', onPress: handleLibrary },
      ]);
    }
  };

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
                {instrumentUsagePeriod && (
                  <Paragraph color="$color11" size="$2">
                    使用期間: {instrumentUsagePeriod}
                  </Paragraph>
                )}
              </YStack>
            )}
          />

          {Platform.OS !== 'web' && (
            <YStack gap="$2">
              <Paragraph color="$color12">楽器の写真（任意）</Paragraph>
              {photoUri ? (
                <XStack gap="$3" items="center" p="$3" bg="$color2" rounded="$3">
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: 72, height: 72, borderRadius: 8 }}
                    accessibilityLabel="楽器の写真"
                  />
                  <YStack flex={1} gap="$2">
                    <Button size="$2" onPress={showPhotoOptions} aria-label="写真を変更">
                      写真を変更
                    </Button>
                    <Button
                      size="$2"
                      theme="red"
                      variant="outlined"
                      onPress={() => {
                        if (photoUri) {
                          try {
                            new File(photoUri).delete();
                          } catch {}
                        }
                        setValue('instrument.photoUri', undefined, { shouldValidate: true });
                      }}
                      aria-label="写真を削除"
                    >
                      ✕ 削除
                    </Button>
                  </YStack>
                </XStack>
              ) : (
                <Pressable onPress={showPhotoOptions} aria-label="楽器の写真を追加">
                  <XStack
                    gap="$3"
                    items="center"
                    p="$3"
                    bg="$color2"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <Paragraph fontSize="$6">📷</Paragraph>
                    <YStack>
                      <Paragraph fontWeight="bold">楽器の写真を追加</Paragraph>
                      <Paragraph fontSize="$2" color="$color10">
                        タップして撮影またはライブラリから選択
                      </Paragraph>
                    </YStack>
                  </XStack>
                </Pressable>
              )}
            </YStack>
          )}
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
                  {sectionUsagePeriods[section.key] && (
                    <Paragraph color="$color11" size="$2">
                      使用期間: {sectionUsagePeriods[section.key]}
                    </Paragraph>
                  )}
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
