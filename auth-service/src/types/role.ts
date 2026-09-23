export const ROLES = ['patient', 'doctor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

export const SELF_REGISTERABLE_ROLES = ['patient', 'doctor'] as const satisfies readonly Role[];

export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];
