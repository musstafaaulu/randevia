import { createHash, randomBytes } from 'node:crypto';

// Shared by RefreshToken and VerificationToken: both store only a hash of an
// opaque random string, never the string itself, so a database leak alone
// doesn't hand out a usable token.
export function generateOpaqueToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
