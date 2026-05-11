import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { signInSchema, type SignInValues } from '@/forms/sign-in';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignInValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) Alert.alert('エラー', toJaError(error.message));
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$6" fontWeight="bold" color="$color12">
        クラリネット練習帳
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
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="パスワード"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            width="100%"
          />
        )}
      />
      <FieldError message={errors.password?.message} />

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        サインイン
      </Button>

      <Link href="/(auth)/forgot-password">
        <Paragraph color="$blue10">パスワードを忘れた方はこちら</Paragraph>
      </Link>

      <Paragraph color="$color11">
        アカウントをお持ちでない方は{' '}
        <Link href="/(auth)/sign-up">
          <Paragraph color="$blue10">サインアップ</Paragraph>
        </Link>
      </Paragraph>
    </YStack>
  );
}
