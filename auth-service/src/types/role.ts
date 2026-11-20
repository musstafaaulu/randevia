export const ROLES = ['patient', 'doctor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

// Anyone can sign up as a patient; doctor and admin roles are only granted by
// an admin through PATCH /api/v1/auth/users/:id/role.
export const SELF_REGISTERABLE_ROLES = ['patient'] as const satisfies readonly Role[];

export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];
