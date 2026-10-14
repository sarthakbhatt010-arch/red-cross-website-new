const express = require('express');
const applicationApi = require('./lib/application-api');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.static(__dirname, { extensions: ['html'] }));
app.use('/api/applications', applicationApi);

app.get('/api/health', (request, response, next) => {
  request.url = '/';
  applicationApi(request, response, next);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Youth Red Cross site available at http://127.0.0.1:${port}`);
});
