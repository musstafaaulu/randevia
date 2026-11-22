import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

// openapi.yaml sits one level up from this file both in dev (src/openapi.ts,
// so '..' is the service root) and in the built image (dist/openapi.js,
// where the Dockerfile copies the file to the same place next to dist/).
const openapiPath = path.join(__dirname, '..', 'openapi.yaml');

export const openapiDocument: object = parse(readFileSync(openapiPath, 'utf8'));
