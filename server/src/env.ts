import dotenv from 'dotenv';

dotenv.config();

// On Vercel the stable production domain is provided automatically, so
// APP_URL and the OAuth redirect URI only need to be set explicitly when
// they differ from it (e.g. a custom domain).
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : '';

const appUrl = process.env.APP_URL || vercelUrl || 'http://localhost:5173';

export const env = {
  port: Number(process.env.PORT || 4000),
  appUrl,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    (vercelUrl
      ? `${vercelUrl}/api/auth/google/callback`
      : 'http://localhost:4000/api/auth/google/callback'),
  timezone: process.env.TIMEZONE || 'America/Chicago',
  // Postgres connection string (e.g. Neon via Vercel's Storage tab). When
  // unset, an embedded Postgres (PGlite) is used so local dev needs no setup.
  databaseUrl: process.env.DATABASE_URL || '',
  isVercel: Boolean(process.env.VERCEL),
};

export const googleConfigured = () => Boolean(env.googleClientId && env.googleClientSecret);
