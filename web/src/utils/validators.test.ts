import { describe, expect, it } from 'vitest';
import { isValidEmail } from './validators';

describe('isValidEmail', () => {
  it.each(['ada@example.com', 'a.b+c@sub.example.co.uk'])('accepts %s', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it.each(['not-an-email', 'missing-domain@', '@missing-local.com', 'spaced out@example.com', ''])(
    'rejects %s',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});
