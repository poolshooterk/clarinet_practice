import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { resetPasswordOtpSchema, type ResetPasswordOtpValues } from '@/forms/reset-password-otp';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordOtp() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordOtpValues>({
    resolver: zodResolver(resetPasswordOtpSchema),
    defaultValues: { email: email ?? '', token: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: ResetPasswordOtpValues) => {
    const { error } = await supabase.auth.verifyOtp({
      email: values.email,
      token: values.token,
      type: 'recovery',
    });
    if (error) {
      Alert.alert('エラー', toJaError(error.message));
    }
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$5" fontWeight="bold" color="$color12">
        確認コードを入力
      </Paragraph>
      <Paragraph color="$color11" text="center">
        メールに記載された6桁のコードを入力してください
      </Paragraph>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="メールアドレス"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            width="100%"
          />
        )}
      />
      <FieldError message={errors.email?.message} />

      <Controller
        control={control}
        name="token"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="6桁のコード"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="number-pad"
            maxLength={6}
            width="100%"
          />
        )}
      />
      <FieldError message={errors.token?.message} />

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        コードを確認する
      </Button>

      <Link href="/(auth)/forgot-password">
        <Paragraph color="$blue10">← メール送信画面に戻る</Paragraph>
      </Link>
    </YStack>
  );
}
