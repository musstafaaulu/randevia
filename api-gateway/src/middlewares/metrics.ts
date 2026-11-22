import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';
import { matchesPrefix, SERVICE_ROUTES } from '../proxy/services';

// One registry per process, collected by Prometheus directly from this
// service's own /metrics (not through its own proxying - see
// docker-compose.yml's prometheus service and monitoring/prometheus/prometheus.yml).
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

// The gateway proxies raw paths (e.g. "/api/v1/appointments/<id>/confirm")
// rather than matching Express route params, so there is no req.route to
// read a template from - the configured prefix is used instead, which keeps
// the label's cardinality bounded the same way.
function routeLabel(req: Request): string {
  const match = SERVICE_ROUTES.find(({ prefix }) => matchesPrefix(req.path, prefix));
  return match?.prefix ?? req.path;
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
