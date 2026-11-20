import type { GatewayConfig } from '../config/env';

export type ServiceName = 'auth-service' | 'appointment-service' | 'notification-service';

export interface ServiceRoute {
  // Public path prefix. It is forwarded unchanged, since every service
  // already serves its routes under /api/v1.
  prefix: string;
  service: ServiceName;
}

export const SERVICE_ROUTES: readonly ServiceRoute[] = [
  { prefix: '/api/v1/auth', service: 'auth-service' },
  { prefix: '/api/v1/doctors', service: 'appointment-service' },
  { prefix: '/api/v1/appointments', service: 'appointment-service' },
  { prefix: '/api/v1/notifications', service: 'notification-service' },
];

export function serviceUrls(config: GatewayConfig): Record<ServiceName, string> {
  return {
    'auth-service': config.AUTH_SERVICE_URL,
    'appointment-service': config.APPOINTMENT_SERVICE_URL,
    'notification-service': config.NOTIFICATION_SERVICE_URL,
  };
}

// Matches the prefix itself and anything below it, but not e.g. /api/v1/authors.
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
