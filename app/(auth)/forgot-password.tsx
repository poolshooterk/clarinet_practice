import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/forms/forgot-password';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: 'clarinets:///reset-password',
    });
    if (error) {
      Alert.alert('エラー', toJaError(error.message));
    } else {
      Alert.alert('メールを送信しました', '届いたリンクからパスワードを再設定してください', [
        { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    }
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$5" fontWeight="bold" color="$color12">
        パスワードリセット
      </Paragraph>
      <Paragraph color="$color11" text="center">
        登録済みメールアドレスにリセット用のリンクを送ります
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

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        リセットメールを送る
      </Button>

      <Link href="/(auth)/sign-in">
        <Paragraph color="$blue10">← サインインに戻る</Paragraph>
      </Link>
    </YStack>
  );
}
