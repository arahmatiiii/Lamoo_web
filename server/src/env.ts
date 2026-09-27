export interface Env {
  port: number;
  host: string;
  dbPath: string;
  /** Turn off once your household and friends have signed up. */
  allowRegistration: boolean;
  /** `*` is fine here: auth is a bearer token, never a cookie. */
  corsOrigin: string;
  maxImageBytes: number;
  cardTtlHours: number;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function loadEnv(overrides: Partial<Env> = {}): Env {
  return {
    port: int(process.env.PORT, 8787),
    host: process.env.HOST ?? '0.0.0.0',
    dbPath: process.env.DB_PATH ?? './data/lamoo.db',
    allowRegistration: bool(process.env.ALLOW_REGISTRATION, true),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    maxImageBytes: int(process.env.MAX_IMAGE_BYTES, 400_000),
    cardTtlHours: int(process.env.CARD_TTL_HOURS, 24),
    ...overrides,
  };
}
