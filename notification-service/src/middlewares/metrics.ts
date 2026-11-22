import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

// One registry per process, collected by Prometheus directly from this
// service's own /metrics (not through the gateway - see docker-compose.yml's
// prometheus service and monitoring/prometheus/prometheus.yml).
client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Set by queueLengthPoller.ts - the RabbitMQ queue depths this service owns.
export const rabbitmqQueueMessages = new client.Gauge({
  name: 'rabbitmq_queue_messages',
  help: 'Ready messages in a RabbitMQ queue, as last polled',
  labelNames: ['queue'],
});

// Route templates (e.g. "/api/v1/notifications/:id/read"), not raw paths - a
// per-notification-id label would make the metric's cardinality grow
// without bound.
function routeLabel(req: Request): string {
  const route = req.route as { path?: string } | undefined;
  if (!route?.path) return req.path;
  const mountPath = req.baseUrl || '';
  return `${mountPath}${route.path}`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
}
