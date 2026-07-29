import { EMBOUCHURE_SECTIONS, EMBOUCHURE_TIP, EMBOUCHURE_WARNING_SIGNS } from '@/forms/embouchure';

describe('EMBOUCHURE_SECTIONS', () => {
  it('アンブシュアと呼吸の 2 セクションを持つ', () => {
    expect(EMBOUCHURE_SECTIONS.map((s) => s.id)).toEqual(['embouchure', 'breathing']);
  });

  it('各セクションに 1 つ以上の項目がある', () => {
    for (const section of EMBOUCHURE_SECTIONS) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it('項目 id はセクション横断で一意', () => {
    const ids = EMBOUCHURE_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('各項目は空でない label と hint を持つ', () => {
    for (const section of EMBOUCHURE_SECTIONS) {
      for (const item of section.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('各セクションは空でない title を持つ', () => {
    for (const section of EMBOUCHURE_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
    }
  });
});

describe('EMBOUCHURE_WARNING_SIGNS / EMBOUCHURE_TIP', () => {
  it('崩れ・疲れのサインを 1 つ以上提供する', () => {
    expect(EMBOUCHURE_WARNING_SIGNS.length).toBeGreaterThan(0);
    for (const sign of EMBOUCHURE_WARNING_SIGNS) {
      expect(sign.length).toBeGreaterThan(0);
    }
  });

  it('上部の一言を提供する', () => {
    expect(EMBOUCHURE_TIP.length).toBeGreaterThan(0);
  });
});
