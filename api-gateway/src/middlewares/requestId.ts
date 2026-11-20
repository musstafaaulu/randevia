import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept a caller-supplied id only if it is short and harmless to log.
const VALID_REQUEST_ID = /^[\w.:-]{1,128}$/;

// Tags every request with an id that is echoed to the client and forwarded to
// the upstream service, so one request can be traced across all service logs.
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.id = id;
  req.headers[REQUEST_ID_HEADER] = id;
  res.setHeader('X-Request-Id', id);
  next();
}
