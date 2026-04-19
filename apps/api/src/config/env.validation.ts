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
