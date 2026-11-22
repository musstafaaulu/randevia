// Loaded with `node -r ./dist/tracing.js` (see package.json's start script
// and the Dockerfile), never imported from application code: OpenTelemetry's
// auto-instrumentation patches modules (express, mongoose, amqplib, http, ...)
// at require() time, so this has to run and call sdk.start() before anything
// else requires them. It never loads during `npm test` (Jest imports
// src/app.ts directly, not through this entry point), which is deliberate -
// tests don't need a trace exporter trying to reach Jaeger.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://jaeger:4318';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'appointment-service' }),
  traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Noisy and not interesting here: every readiness probe would otherwise
      // show up as its own trace.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

function shutdown(): void {
  void sdk.shutdown();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
