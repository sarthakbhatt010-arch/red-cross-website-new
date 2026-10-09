const express = require('express');
const applicationRouter = require('../lib/application-api');

const app = express();
app.use('/api/applications', applicationRouter);
app.use('/', applicationRouter);

module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
