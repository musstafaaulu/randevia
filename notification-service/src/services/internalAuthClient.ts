import { env } from '../config/env';

interface InternalUserResponse {
  success: boolean;
  data: { id: string; name: string; email: string; role: string };
}

// notification-service never calls auth-service for anything else - events
// already carry every id this service needs. This is the one exception:
// sending a real e-mail needs an address, and nothing in the event contract
// denormalizes one (see notificationSender.ts). Throws on any failure, same
// as a dead SMTP server, so the caller's existing retry-via-RabbitMQ handles
// auth-service being briefly unreachable too.
export async function getUserEmail(userId: string): Promise<string> {
  const res = await fetch(`${env.AUTH_SERVICE_URL}/api/v1/auth/internal/users/${userId}`, {
    headers: { 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN },
  });

  if (!res.ok) {
    throw new Error(`auth-service lookup for user ${userId} failed with status ${res.status}`);
  }

  const body = (await res.json()) as InternalUserResponse;
  return body.data.email;
}
