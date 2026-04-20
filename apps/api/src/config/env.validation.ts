import * as Joi from 'joi';

export interface EnvVars {
  NODE_ENV: string;
  API_PORT?: number;
  API_GLOBAL_PREFIX?: string;
  DATABASE_URL: string;
  CORS_ORIGIN?: string;
  DB_SYNCHRONIZE?: string;
  DB_RUN_MIGRATIONS?: string;
  DEV_TENANT_ID?: string;
  /** Optional override for the on-disk media storage root. Defaults to <cwd>/storage/media. */
  MEDIA_STORAGE_ROOT?: string;
  /**
   * Parent Invite Delivery & Access Reliability Pack — optional SMTP
   * configuration for transactional invite emails. When unset, the
   * platform stays in the truthful "delivery unavailable" state and
   * staff use the manual-share fallback exposed in the staff UI.
   */
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  /**
   * Public origin (scheme + host) used when the API needs to render an
   * absolute parent activation link in outgoing email. When unset the
   * activation link falls back to the relative path the staff already
   * see in the UI; the manual-share path remains fully functional.
   */
  PORTAL_PUBLIC_ORIGIN?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test', 'staging')
      .default('development'),
    API_PORT: Joi.number().port().optional(),
    API_GLOBAL_PREFIX: Joi.string().optional(),
    DATABASE_URL: Joi.string()
      .pattern(/^postgres(ql)?:\/\//)
      .required()
      .messages({ 'string.pattern.base': 'DATABASE_URL must be a PostgreSQL connection string' }),
    CORS_ORIGIN: Joi.string().optional().allow(''),
    DB_SYNCHRONIZE: Joi.string().valid('true', 'false').optional(),
    DB_RUN_MIGRATIONS: Joi.string().valid('true', 'false').optional(),
    /** Optional UUID for local/dev requests when no auth tenant exists (header X-Tenant-Id overrides). */
    DEV_TENANT_ID: Joi.string().uuid().optional(),
    /**
     * Wave 16 — optional override for the local media storage root.  If unset
     * the API uses `<cwd>/storage/media`; production deployments can point
     * this at a persistent volume.
     */
    MEDIA_STORAGE_ROOT: Joi.string().optional().allow(''),
    /**
     * Parent Invite Delivery & Access Reliability Pack — SMTP knobs.
     * Every field is optional. When `SMTP_HOST` and `SMTP_FROM` are
     * both set, the platform attempts real email delivery; otherwise
     * staff get the truthful "delivery unavailable, share the link
     * manually" fallback in the UI.
     */
    SMTP_HOST: Joi.string().optional().allow(''),
    SMTP_PORT: Joi.string().optional().allow(''),
    SMTP_SECURE: Joi.string().valid('true', 'false', '1', '0').optional().allow(''),
    SMTP_USER: Joi.string().optional().allow(''),
    SMTP_PASSWORD: Joi.string().optional().allow(''),
    SMTP_FROM: Joi.string().optional().allow(''),
    PORTAL_PUBLIC_ORIGIN: Joi.string().optional().allow(''),
  });

  const { error, value } = schema.validate(config, {
    allowUnknown: true,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value;
}
