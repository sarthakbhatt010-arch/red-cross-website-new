const express = require('express');
const applicationApi = require('./lib/application-api');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.static(__dirname, { extensions: ['html'] }));
app.use('/api/applications', applicationApi);

app.get('/api/health', (_request, response) => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  response.status(configured ? 200 : 503).json({ status: configured ? 'configured' : 'supabase_not_configured' });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Youth Red Cross site available at http://127.0.0.1:${port}`);
});
