import { describe, expect, it } from 'vitest';
import { avatarColor } from './avatarColor';

describe('avatarColor', () => {
  it('returns the same colour for the same name every time', () => {
    expect(avatarColor('Dr. Elif Arslan')).toBe(avatarColor('Dr. Elif Arslan'));
  });

  it('returns a valid CSS hex colour', () => {
    expect(avatarColor('Dr. Can Yıldız')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('spreads names across more than one colour', () => {
    const names = ['Ayşe', 'Mert', 'Zeynep', 'Can', 'Elif', 'Demo Doktor', 'Jane Doe', 'John Smith'];
    const colours = new Set(names.map(avatarColor));
    expect(colours.size).toBeGreaterThan(1);
  });
});
