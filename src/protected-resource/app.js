const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cons = require('consolidate');
const { createLogger, format, transports } = require('winston');
const logger = createLogger({
  format: format.combine(
    format.colorize(),
    format.splat(),
    format.simple()
  ),
  transports: [new transports.Console({ level: 'debug' })]
});
var app = express();

app.set('appname', 'protected-resource');
app.set('json spaces', 2);
app.set('port', process.env.PORT || 9002);
app.set('host', process.env.HOST || 'localhost');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', cons.underscore);

app.use(express.static('views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const resource = {
  "name": "Protected Resource",
  "description": "This data has been protected by OAuth 2.0"
};

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/resource', (req, res) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    logger.error('Authorization header is missing.');
    res.status(401).end();
  }
  logger.debug('Authorization header found.');
  logger.debug('Incoming access_token: %s', authorization.substring('Bearer '.length));
  res.status(200).json(resource);
});

const options = {
  key: fs.readFileSync(path.join(__dirname, '../server.key')),
  cert: fs.readFileSync(path.join(__dirname, '../server.crt'))
};

const server = https.createServer(options, app);

server.listen(app.get('port'), app.get('host'), () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log(`OAuth Resource Server listening at https://${host}:${port}/`);
});
