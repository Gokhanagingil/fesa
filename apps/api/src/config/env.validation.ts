import * as Joi from 'joi';

export interface EnvVars {
  NODE_ENV: string;
  API_PORT?: number;
  API_GLOBAL_PREFIX?: string;
  DATABASE_URL: string;
  CORS_ORIGIN?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    API_PORT: Joi.number().port().optional(),
    API_GLOBAL_PREFIX: Joi.string().optional(),
    DATABASE_URL: Joi.string()
      .pattern(/^postgres(ql)?:\/\//)
      .required()
      .messages({ 'string.pattern.base': 'DATABASE_URL must be a PostgreSQL connection string' }),
    CORS_ORIGIN: Joi.string().optional().allow(''),
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
