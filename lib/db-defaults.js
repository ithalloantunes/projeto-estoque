// Configure hosted database connections through environment variables.
// Local startup supplies its private connection from .runtime/local-config.json.
export const DEFAULT_DATABASE_URL = process.env.DEFAULT_DATABASE_URL || '';
export const DEFAULT_DATABASE_URL_EXTERNAL = process.env.DEFAULT_DATABASE_URL_EXTERNAL || '';

export default { DEFAULT_DATABASE_URL, DEFAULT_DATABASE_URL_EXTERNAL };
