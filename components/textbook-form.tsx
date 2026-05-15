import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  DIFFICULTY_OPTIONS,
  GENRE_OPTIONS,
  type TextbookInput,
  textbookSchema,
} from '@/forms/textbook';

const defaultOnSubmit = (_values: TextbookInput) => {
  Alert.alert('保存しました');
};

type Props = {
  defaultValues?: TextbookInput;
  onSubmit?: (values: TextbookInput) => void | Promise<void>;
  onDelete?: () => void;
};

export function TextbookForm({ defaultValues, onSubmit = defaultOnSubmit, onDelete }: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TextbookInput>({
    resolver: zodResolver(textbookSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? {
      title: '',
      publisher: '',
      genre: undefined,
      difficulty: undefined,
      totalPages: undefined,
    },
  });

  return (
    <YStack gap="$4" p="$4">
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">教本名 *</Paragraph>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="例: ローズ 32のエチュード"
              aria-label="教本名"
            />
            <FieldError message={errors.title?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="genre"
        render={({ field: { onChange, value } }) => (
          <YStack gap="$2">
            <Paragraph color="$color12">ジャンル *</Paragraph>
            <XStack flexWrap="wrap" gap="$2">
              {GENRE_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  size="$2"
                  theme={value === opt ? 'blue' : undefined}
                  variant={value === opt ? undefined : 'outlined'}
                  onPress={() => onChange(opt)}
                  aria-label={`ジャンル ${opt}`}
                >
                  {opt}
                </Button>
              ))}
            </XStack>
            <FieldError message={errors.genre?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="publisher"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">出版社</Paragraph>
            <Input
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="例: 全音楽譜出版社"
              aria-label="出版社"
            />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="difficulty"
        render={({ field: { onChange, value } }) => (
          <YStack gap="$2">
            <Paragraph color="$color12">難易度</Paragraph>
            <XStack flexWrap="wrap" gap="$2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  size="$2"
                  theme={value === opt ? 'blue' : undefined}
                  variant={value === opt ? undefined : 'outlined'}
                  onPress={() => onChange(value === opt ? undefined : opt)}
                  aria-label={`難易度 ${opt}`}
                >
                  {opt}
                </Button>
              ))}
            </XStack>
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="totalPages"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">総ページ数</Paragraph>
            <Input
              value={value !== undefined ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number(t);
                onChange(t === '' || isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              placeholder="例: 100"
              keyboardType="numeric"
              aria-label="総ページ数"
            />
            <FieldError message={errors.totalPages?.message} />
          </YStack>
        )}
      />

      <Button theme="blue" onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
        保存
      </Button>

      {onDelete && (
        <Button theme="red" variant="outlined" onPress={onDelete} mt="$4">
          この教本を削除
        </Button>
      )}
    </YStack>
  );
}
