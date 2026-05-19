import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { resetPasswordSchema, type ResetPasswordValues } from '@/forms/reset-password';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      Alert.alert('エラー', toJaError(error.message));
    } else {
      Alert.alert('パスワードを変更しました', 'パスワードの変更が完了しました', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/') },
      ]);
    }
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$5" fontWeight="bold" color="$color12">
        新しいパスワードを設定
      </Paragraph>

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="新しいパスワード (8文字以上)"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            width="100%"
          />
        )}
      />
      <FieldError message={errors.password?.message} />

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="パスワードを確認"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            width="100%"
          />
        )}
      />
      <FieldError message={errors.confirmPassword?.message} />

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        パスワードを更新する
      </Button>
    </YStack>
  );
}
