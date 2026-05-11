import { clarinetEquipmentSchema, formatDate, parseYmd } from '@/forms/equipment';

const validEquipment = {
  instrument: { name: 'B♭クラリネット', startDate: '2020-04-01' },
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

  it('範囲外の日付コンポーネントは regex を通過し Date がロールオーバーする', () => {
    // regex は通過するが JS Date がロールオーバーするため null にはならない
    expect(parseYmd('2024-13-40')).not.toBeNull();
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

describe('clarinetEquipmentSchema', () => {
  it('有効な全フィールドを受け入れる', () => {
    expect(clarinetEquipmentSchema.safeParse(validEquipment).success).toBe(true);
  });

  it('instrument.name が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validEquipment.instrument, name: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'name']);
    }
  });

  it('startDate が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validEquipment.instrument, startDate: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'startDate']);
    }
  });

  it('startDate の形式が YYYY-MM-DD でないとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validEquipment.instrument, startDate: '2024/01/15' },
    });
    expect(r.success).toBe(false);
  });

  it('未来の startDate を拒否する', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validEquipment.instrument, startDate: formatDate(future) },
    });
    expect(r.success).toBe(false);
  });

  it('今日の日付は受け入れる', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validEquipment.instrument, startDate: formatDate(new Date()) },
    });
    expect(r.success).toBe(true);
  });

  it('全セクションが同時にエラーを返す', () => {
    const r = clarinetEquipmentSchema.safeParse({
      instrument: { name: '', startDate: '' },
      reed: { name: '', startDate: '' },
      ligature: { name: '', startDate: '' },
      mouthpiece: { name: '', startDate: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const sections = new Set(r.error.issues.map((i) => i.path[0]));
      expect(sections).toEqual(new Set(['instrument', 'reed', 'ligature', 'mouthpiece']));
    }
  });
});
