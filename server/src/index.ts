import { app } from './app.js';
import { env } from './env.js';

app.listen(env.port, () => {
  console.log(`CRM server listening on http://localhost:${env.port}`);
});
