const applicationRouter = require('../lib/application-api');

module.exports = applicationRouter;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
