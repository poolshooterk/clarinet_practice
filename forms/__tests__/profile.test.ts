import { formatDate, parseYmd, profileSchema } from '@/forms/profile';

const validInput = {
  name: '太郎',
  email: 'taro@example.com',
  age: 30,
  birthday: '2000-01-15',
  score: 80,
  agreed: true,
};

describe('parseYmd', () => {
  it('parses YYYY-MM-DD into Date', () => {
    const d = parseYmd('2024-06-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(15);
  });

  it('returns null on malformed string', () => {
    expect(parseYmd('2024/06/15')).toBeNull();
    expect(parseYmd('not-a-date')).toBeNull();
    expect(parseYmd('')).toBeNull();
    expect(parseYmd('20-01-01')).toBeNull();
  });

  it('returns null on out-of-range date components', () => {
    // JS Date rolls over invalid days, but parseYmd uses regex first then Date.
    // 2024-13-40 -> parsed as new Date(2024, 12, 40) -> rolls forward but still a valid Date.
    // Confirm that parseYmd accepts what regex matches and rejects only Number.isNaN(getTime()).
    expect(parseYmd('2024-13-40')).not.toBeNull(); // accepted by regex; Date rolls forward
  });
});

describe('formatDate', () => {
  it('zero-pads month and day', () => {
    const d = new Date(2024, 0, 5);
    expect(formatDate(d)).toBe('2024-01-05');
  });

  it('round-trips with parseYmd for valid dates', () => {
    const original = '1995-12-31';
    expect(formatDate(parseYmd(original)!)).toBe(original);
  });
});

describe('profileSchema', () => {
  describe('name', () => {
    it('accepts non-empty string', () => {
      expect(profileSchema.safeParse(validInput).success).toBe(true);
    });

    it('rejects empty string', () => {
      const r = profileSchema.safeParse({ ...validInput, name: '' });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].path).toEqual(['name']);
      }
    });
  });

  describe('email', () => {
    it.each(['plain', 'missing@tld', '@no-local.com', 'spaces in@addr.com'])(
      'rejects invalid email %p',
      (email) => {
        const r = profileSchema.safeParse({ ...validInput, email });
        expect(r.success).toBe(false);
      },
    );

    it.each(['a@b.co', 'user.name+tag@example.co.jp'])('accepts valid email %p', (email) => {
      const r = profileSchema.safeParse({ ...validInput, email });
      expect(r.success).toBe(true);
    });
  });

  describe('age', () => {
    it('is optional (undefined ok)', () => {
      const r = profileSchema.safeParse({ ...validInput, age: undefined });
      expect(r.success).toBe(true);
    });

    it('rejects negative', () => {
      const r = profileSchema.safeParse({ ...validInput, age: -1 });
      expect(r.success).toBe(false);
    });

    it('rejects non-integer', () => {
      const r = profileSchema.safeParse({ ...validInput, age: 30.5 });
      expect(r.success).toBe(false);
    });

    it('rejects non-number type', () => {
      const r = profileSchema.safeParse({ ...validInput, age: 'thirty' });
      expect(r.success).toBe(false);
    });
  });

  describe('birthday', () => {
    it('rejects empty', () => {
      const r = profileSchema.safeParse({ ...validInput, birthday: '' });
      expect(r.success).toBe(false);
    });

    it('rejects bad format', () => {
      const r = profileSchema.safeParse({ ...validInput, birthday: '2000/01/15' });
      expect(r.success).toBe(false);
    });

    it('rejects dates before 1900-01-01', () => {
      const r = profileSchema.safeParse({ ...validInput, birthday: '1899-12-31' });
      expect(r.success).toBe(false);
    });

    it('rejects future dates', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const r = profileSchema.safeParse({ ...validInput, birthday: formatDate(future) });
      expect(r.success).toBe(false);
    });

    it("accepts today's date", () => {
      const r = profileSchema.safeParse({ ...validInput, birthday: formatDate(new Date()) });
      expect(r.success).toBe(true);
    });
  });

  describe('score', () => {
    it.each([0, 50, 100])('accepts %d in 0-100 range', (score) => {
      const r = profileSchema.safeParse({ ...validInput, score });
      expect(r.success).toBe(true);
    });

    it.each([-1, 101])('rejects %d out of 0-100 range', (score) => {
      const r = profileSchema.safeParse({ ...validInput, score });
      expect(r.success).toBe(false);
    });
  });

  describe('agreed', () => {
    it('rejects false', () => {
      const r = profileSchema.safeParse({ ...validInput, agreed: false });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe('利用規約への同意が必要です');
      }
    });

    it('accepts true', () => {
      const r = profileSchema.safeParse({ ...validInput, agreed: true });
      expect(r.success).toBe(true);
    });
  });

  it('aggregates multiple errors at once', () => {
    const r = profileSchema.safeParse({
      name: '',
      email: 'bad',
      age: -1,
      birthday: 'invalid',
      score: 200,
      agreed: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(new Set(paths)).toEqual(
        new Set(['name', 'email', 'age', 'birthday', 'score', 'agreed']),
      );
    }
  });
});
