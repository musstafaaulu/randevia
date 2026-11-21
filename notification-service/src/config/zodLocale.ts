import { z } from 'zod';
import { tr } from 'zod/locales';

// Every user-facing message must be Turkish, including the auto-generated
// ones Zod produces for schemas that have no custom message (enums, type
// mismatches, string length, ...). Must run before the first .parse() call,
// so this is imported first thing in app.ts.
z.config(tr());
