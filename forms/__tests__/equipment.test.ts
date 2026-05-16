import { calcUsagePeriod, clarinetEquipmentSchema, formatDate, parseYmd } from '@/forms/equipment';

const validInstrument = {
  makerId: 'maker-1',
  makerName: 'Buffet Crampon',
  modelId: 'model-1',
  modelName: 'R13',
  startDate: '2020-04-01',
};

const validEquipment = {
  instrument: validInstrument,
  reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
  ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
  mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
};

describe('parseYmd', () => {
  it('YYYY-MM-DD 文字列を Date に変換する', () => {
    const d = parseYmd('2024-06-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(15);
  });

  it('不正な文字列は null を返す', () => {
    expect(parseYmd('2024/06/15')).toBeNull();
    expect(parseYmd('not-a-date')).toBeNull();
    expect(parseYmd('')).toBeNull();
    expect(parseYmd('20-01-01')).toBeNull();
  });
});

describe('formatDate', () => {
  it('月・日をゼロパディングする', () => {
    expect(formatDate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('parseYmd との round-trip が成立する', () => {
    const original = '2023-12-31';
    expect(formatDate(parseYmd(original)!)).toBe(original);
  });
});

describe('calcUsagePeriod', () => {
  const ref = new Date(2026, 4, 11); // 2026-05-11

  it('空文字は null を返す', () => {
    expect(calcUsagePeriod('', ref)).toBeNull();
  });

  it('不正な日付は null を返す', () => {
    expect(calcUsagePeriod('not-a-date', ref)).toBeNull();
  });

  it('未来の日付は null を返す', () => {
    expect(calcUsagePeriod('2027-01-01', ref)).toBeNull();
  });

  it('当日は 1ヶ月未満 を返す', () => {
    expect(calcUsagePeriod('2026-05-11', ref)).toBe('1ヶ月未満');
  });

  it('29日差は 1ヶ月未満 を返す', () => {
    expect(calcUsagePeriod('2026-04-12', ref)).toBe('1ヶ月未満');
  });

  it('ちょうど1ヶ月は 1ヶ月 を返す', () => {
    expect(calcUsagePeriod('2026-04-11', ref)).toBe('1ヶ月');
  });

  it('11ヶ月は 11ヶ月 を返す', () => {
    expect(calcUsagePeriod('2025-06-11', ref)).toBe('11ヶ月');
  });

  it('ちょうど1年は 1年 を返す', () => {
    expect(calcUsagePeriod('2025-05-11', ref)).toBe('1年');
  });

  it('年をまたぐ月計算が正しい（9ヶ月）', () => {
    expect(calcUsagePeriod('2025-08-11', ref)).toBe('9ヶ月');
  });

  it('複数年と月を組み合わせて返す', () => {
    expect(calcUsagePeriod('2024-02-11', ref)).toBe('2年3ヶ月');
  });
});

describe('clarinetEquipmentSchema', () => {
  it('有効な全フィールドを受け入れる', () => {
    expect(clarinetEquipmentSchema.safeParse(validEquipment).success).toBe(true);
  });

  it('purchasePrice は省略可能', () => {
    const r = clarinetEquipmentSchema.safeParse(validEquipment);
    expect(r.success).toBe(true);
  });

  it('purchasePrice に数値を渡せる', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, purchasePrice: 850000 },
    });
    expect(r.success).toBe(true);
  });

  it('instrument.makerId が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, makerId: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'makerId']);
    }
  });

  it('instrument.modelId が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, modelId: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'modelId']);
    }
  });

  it('instrument.startDate が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'startDate']);
    }
  });

  it('startDate の形式が YYYY-MM-DD でないとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: '2024/01/15' },
    });
    expect(r.success).toBe(false);
  });

  it('未来の startDate を拒否する', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: formatDate(future) },
    });
    expect(r.success).toBe(false);
  });

  it('今日の日付は受け入れる', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: formatDate(new Date()) },
    });
    expect(r.success).toBe(true);
  });

  it('reed.name が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      reed: { ...validEquipment.reed, name: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['reed', 'name']);
    }
  });
});

describe('clarinetEquipmentSchema / instrument.photoUri', () => {
  it('photoUri が省略されてもバリデーションが通る', () => {
    const result = clarinetEquipmentSchema.safeParse(validEquipment);
    expect(result.success).toBe(true);
  });

  it('photoUri が文字列であればバリデーションが通る', () => {
    const result = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, photoUri: '/path/to/photo.jpg' },
    });
    expect(result.success).toBe(true);
  });
});
