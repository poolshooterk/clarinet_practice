import {
  calcPurchaseDate,
  purchasePlanSavingsSchema,
  purchasePlanSchema,
} from '@/forms/purchase-plan';

describe('calcPurchaseDate', () => {
  it('monthlyTarget が 0 以下のとき null を返す', () => {
    expect(calcPurchaseDate(850000, 200000, 0)).toBeNull();
    expect(calcPurchaseDate(850000, 200000, -1000)).toBeNull();
  });

  it('残額が 0 以下のとき months: 0 / yearMonth: "今すぐ購入可能" を返す', () => {
    const result = calcPurchaseDate(200000, 200000, 30000);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(0);
    expect(result!.yearMonth).toBe('今すぐ購入可能');

    const overpaid = calcPurchaseDate(200000, 300000, 30000);
    expect(overpaid!.months).toBe(0);
  });

  it('通常ケース: 残額 650000 / 月 30000 → 22 ヶ月', () => {
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(22);
  });

  it('yearMonth の形式が "YYYY年M月ごろ" である', () => {
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result!.yearMonth).toMatch(/^\d{4}年\d{1,2}月ごろ$/);
  });

  it('ちょうど割り切れる場合は ceil で同じ値になる', () => {
    const result = calcPurchaseDate(260000, 200000, 30000);
    expect(result!.months).toBe(2);
  });
});

describe('purchasePlanSchema', () => {
  const valid = {
    makerId: 'maker-1',
    makerName: 'Buffet Crampon',
    modelId: 'model-1',
    modelName: 'R13',
    targetPrice: 850000,
    monthlyTarget: 30000,
  };

  it('有効なデータを受け入れる', () => {
    expect(purchasePlanSchema.safeParse(valid).success).toBe(true);
  });

  it('makerId が空文字列のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, makerId: '' }).success).toBe(false);
  });

  it('targetPrice が 0 以下のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, targetPrice: 0 }).success).toBe(false);
  });

  it('targetPrice が null のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, targetPrice: null }).success).toBe(false);
  });

  it('monthlyTarget が 0 以下のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, monthlyTarget: 0 }).success).toBe(false);
  });

  it('monthlyTarget が null のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, monthlyTarget: null }).success).toBe(false);
  });
});

describe('purchasePlanSavingsSchema', () => {
  const valid = { yearMonth: '2026-05', amount: 30000, memo: null };

  it('有効なデータを受け入れる', () => {
    expect(purchasePlanSavingsSchema.safeParse(valid).success).toBe(true);
  });

  it('メモありでも有効', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, memo: 'ボーナス分' }).success).toBe(
      true,
    );
  });

  it('yearMonth が YYYY-MM 形式でないとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, yearMonth: '2026/05' }).success).toBe(
      false,
    );
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, yearMonth: '202605' }).success).toBe(
      false,
    );
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, yearMonth: '2026-5' }).success).toBe(
      false,
    );
  });

  it('amount が 0 以下のとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false);
  });

  it('amount が整数でないとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: 30000.5 }).success).toBe(false);
  });

  it('amount が null のとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: null }).success).toBe(false);
  });
});
