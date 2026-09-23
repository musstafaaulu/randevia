import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        // Express 5 exposes req.query as a getter-only property, so plain
        // assignment throws; shadow it on the request instance instead.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
