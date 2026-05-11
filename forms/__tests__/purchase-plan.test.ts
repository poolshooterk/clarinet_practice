import { calcPurchaseDate, purchasePlanSchema } from '@/forms/purchase-plan';

describe('calcPurchaseDate', () => {
  it('monthlySavings が 0 以下のとき null を返す', () => {
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
    // ceil(650000 / 30000) = ceil(21.67) = 22
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(22);
  });

  it('yearMonth の形式が "YYYY年M月ごろ" である', () => {
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result!.yearMonth).toMatch(/^\d{4}年\d{1,2}月ごろ$/);
  });

  it('ちょうど割り切れる場合は ceil で同じ値になる', () => {
    // 残額 60000 / 月 30000 = 2.0 → 2 ヶ月
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
    currentSavings: 200000,
    monthlySavings: 30000,
  };

  it('有効なデータを受け入れる', () => {
    expect(purchasePlanSchema.safeParse(valid).success).toBe(true);
  });

  it('makerId が空文字列のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, makerId: '' });
    expect(r.success).toBe(false);
  });

  it('targetPrice が 0 以下のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, targetPrice: 0 });
    expect(r.success).toBe(false);
  });

  it('currentSavings が負のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, currentSavings: -1 });
    expect(r.success).toBe(false);
  });

  it('monthlySavings が 0 以下のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, monthlySavings: 0 });
    expect(r.success).toBe(false);
  });
});
