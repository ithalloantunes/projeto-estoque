const DB_USER = 'acai';
const DB_PASSWORD = 'ETShntq0lGuqd1z35WNdCBVRQEfEPF9P';
const DB_NAME = 'acai';
const DB_HOST_INTERNAL = 'dpg-d4aec52li9vc73fgkne0-a';
const DB_HOST_EXTERNAL = 'dpg-d4aec52li9vc73fgkne0-a.oregon-postgres.render.com';

export const DEFAULT_DATABASE_URL =
  `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST_INTERNAL}/${DB_NAME}`;

export const DEFAULT_DATABASE_URL_EXTERNAL =
  `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST_EXTERNAL}/${DB_NAME}`;

export default {
  DEFAULT_DATABASE_URL,
  DEFAULT_DATABASE_URL_EXTERNAL,
};
