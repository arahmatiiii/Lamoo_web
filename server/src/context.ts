import type { Env } from './env.ts';
import type { Repo } from './repo.ts';
import type { Rooms } from './rooms.ts';
import type { RateLimiter } from './ratelimit.ts';

export interface AppContext {
  env: Env;
  repo: Repo;
  rooms: Rooms;
  /** Guards password guessing. */
  authLimiter: RateLimiter;
  /** Guards brute-forcing invite and friend codes. */
  codeLimiter: RateLimiter;
}
