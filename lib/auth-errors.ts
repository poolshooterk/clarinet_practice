const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'Email not confirmed': 'メールアドレスの確認が完了していません',
  'User already registered': 'このメールアドレスはすでに登録されています',
};

export const toJaError = (msg: string): string => ERROR_MAP[msg] ?? 'エラーが発生しました';
