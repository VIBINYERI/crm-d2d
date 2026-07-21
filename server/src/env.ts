import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
  timezone: process.env.TIMEZONE || 'America/Chicago',
  dbPath: process.env.DB_PATH || './data/crm.db',
};

export const googleConfigured = () => Boolean(env.googleClientId && env.googleClientSecret);
