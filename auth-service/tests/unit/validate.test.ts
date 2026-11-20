import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../../src/middlewares/validate';

// Regression test: Express 5 makes req.query a getter, so a query schema used
// to crash with "Cannot set property query" instead of validating.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.string().min(2) }),
      query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
      body: z.object({ name: z.string().trim() }),
    }),
    (req, res) => {
      res.json({ params: req.params, query: req.query, body: req.body });
    },
  );
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: String(err) });
    },
  );
  return app;
}

describe('validate middleware', () => {
  it('replaces params, query and body with their parsed values', async () => {
    const res = await request(buildApp()).post('/items/ab?page=3').send({ name: '  x  ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 'ab' }, query: { page: 3 }, body: { name: 'x' } });
  });

  it('applies query defaults', async () => {
    const res = await request(buildApp()).post('/items/ab').send({ name: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.query).toEqual({ page: 1 });
  });

  it('forwards a validation error for an invalid query', async () => {
    const res = await request(buildApp()).post('/items/ab?page=0').send({ name: 'x' });

    expect(res.status).toBe(400);
  });
});
