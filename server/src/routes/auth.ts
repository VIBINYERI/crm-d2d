import { Router } from 'express';
import { env, googleConfigured } from '../env.js';
import * as google from '../services/google.js';

export const authRouter = Router();

authRouter.get('/google', (_req, res) => {
  if (!googleConfigured()) {
    res.status(400).json({
      error:
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see README).',
    });
    return;
  }
  res.redirect(google.getAuthUrl());
});

authRouter.get('/google/callback', async (req, res) => {
  const code = req.query.code;
  if (typeof code !== 'string') {
    res.redirect(`${env.appUrl}/settings?google=error`);
    return;
  }
  try {
    await google.exchangeCode(code);
    res.redirect(`${env.appUrl}/settings?google=connected`);
  } catch (err) {
    console.error('OAuth callback failed:', err);
    res.redirect(`${env.appUrl}/settings?google=error`);
  }
});

authRouter.get('/google/status', async (_req, res) => {
  res.json({
    configured: googleConfigured(),
    connected: await google.isConnected(),
    email: await google.connectedEmail(),
  });
});

authRouter.post('/google/disconnect', async (_req, res) => {
  await google.disconnect();
  res.json({ ok: true });
});
