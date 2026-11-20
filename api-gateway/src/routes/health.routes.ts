import { Router } from 'express';
import type { GatewayConfig } from '../config/env';
import { ServiceName, serviceUrls } from '../proxy/services';

const HEALTH_CHECK_TIMEOUT_MS = 3000;

type ServiceStatus = { status: 'up'; latencyMs: number } | { status: 'down'; error: string };

async function checkService(baseUrl: string): Promise<ServiceStatus> {
  const startedAt = Date.now();
  try {
    const res = await fetch(new URL('/api/v1/health', baseUrl), {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    if (!res.ok) return { status: 'down', error: `HTTP ${res.status}` };
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { status: 'down', error: err instanceof Error ? err.message : String(err) };
  }
}

export function createHealthRoutes(config: GatewayConfig): Router {
  const router = Router();

  // Liveness of the gateway itself; never depends on the services.
  router.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'api-gateway',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness of the whole system: 503 as soon as one service is down.
  router.get('/services', async (_req, res) => {
    const entries = await Promise.all(
      Object.entries(serviceUrls(config)).map(
        async ([name, url]) => [name, await checkService(url)] as const,
      ),
    );
    const services = Object.fromEntries(entries) as Record<ServiceName, ServiceStatus>;
    const allUp = entries.every(([, result]) => result.status === 'up');

    res.status(allUp ? 200 : 503).json({
      success: allUp,
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    });
  });

  return router;
}
