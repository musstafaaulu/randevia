export const ROLES = ['patient', 'doctor', 'admin'] as const;

export type Role = (typeof ROLES)[number];
