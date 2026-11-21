import { resetRateLimitedServices } from './resetRateLimits';

// See resetRateLimits.ts for why this matters: starts every run with a
// fresh credential-rate-limit budget, not whatever was left over from the
// previous run or from manual testing against the same stack.
export default function globalSetup(): void {
  resetRateLimitedServices();
}
