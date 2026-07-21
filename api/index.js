// Vercel serverless entry point: the whole Express API runs as one function.
// `vercel.json` rewrites /api/* here; the original URL is preserved, so the
// Express routes (mounted at /api/...) match unchanged. The server workspace
// is compiled to server/dist by the build command before functions bundle.
import { app } from '../server/dist/app.js';

export default app;
