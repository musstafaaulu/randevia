import './config/zodLocale';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { metricsHandler, metricsMiddleware } from './middlewares/metrics';
import { notFoundHandler } from './middlewares/notFoundHandler';
import routes from './routes';
import logger from './utils/logger';

const app: Application = express();
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Scraped by Prometheus directly (docker network), not through the gateway
// or behind the rate limiter below - a scrape must never 429.
app.get('/metrics', metricsHandler);
app.use(metricsMiddleware);

app.use(
  // The api-gateway tags each request with X-Request-Id; log it to correlate.
  morgan(
    ':req[x-request-id] :remote-addr ":method :url" :status :res[content-length] - :response-time ms',
    {
      stream: { write: (message: string) => logger.http(message.trim()) },
    },
  ),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Çok fazla istek gönderdiniz, lütfen biraz sonra tekrar deneyin' },
  }),
);

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
