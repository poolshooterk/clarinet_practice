import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { signUpSchema, type SignUpValues } from '@/forms/sign-up';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignUpValues) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    if (error) {
      Alert.alert('エラー', toJaError(error.message));
    } else {
      Alert.alert(
        '確認メールを送信しました',
        'メール内のリンクをクリックしてサインインしてください',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    }
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$5" fontWeight="bold" color="$color12">
        アカウント作成
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

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="パスワード（確認）"
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
        アカウントを作成
      </Button>

      <Paragraph color="$color10" size="$2">
        登録後、確認メールが届きます
      </Paragraph>

      <Paragraph color="$color11">
        アカウントをお持ちの方は{' '}
        <Link href="/(auth)/sign-in">
          <Paragraph color="$blue10">サインイン</Paragraph>
        </Link>
      </Paragraph>
    </YStack>
  );
}
