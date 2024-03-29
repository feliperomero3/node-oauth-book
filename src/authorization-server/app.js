const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cons = require('consolidate');
const __ = require('underscore');
__.string = require('underscore.string');
const url = require("url");
const randomstring = require("randomstring");
const querystring = require('querystring');
const { createLogger, format, transports } = require('winston');
const logger = createLogger({
  format: format.combine(
    format.colorize(),
    format.splat(),
    format.simple()
  ),
  transports: [new transports.Console({ level: 'debug' })]
});
const favicon = require('serve-favicon');

var app = express();

app.set('appname', 'authorization-server');
app.set('json spaces', 2);
app.set('port', process.env.PORT || 9001);
app.set('host', process.env.HOST || 'localhost');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', cons.underscore);

app.use(express.static('views'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const authorizationServer = {
  authorizationEndpoint: 'https://localhost:9001/authorize',
  tokenEndpoint: 'https://localhost:9001/token'
};

const clients = [{
  "client_id": "oauth-client-1",
  "client_secret": "oauth-client-secret-1",
  "redirect_uris": ["https://localhost:9000/callback"],
  "scope": "foo bar"
}];

var codes = {};

var requests = {};

/**
 * Get a client by client ID.
 * @param {string} clientId - The client ID.
 * @returns The client object.
 */
var getClient = (clientId) => {
  return __.find(clients, (client) => client.client_id === clientId);
};

app.get('/', (req, res) => {
  res.render('index', { clients: clients, authServer: authorizationServer });
});

/**
 * Process authorization request from the client.
 */
app.get('/authorize', (req, res) => {
  var client = getClient(req.query.client_id);

  if (!client) {
    logger.warn('Unknown client %s', req.query.client_id);
    res.render('error', { error: 'Unknown client' });
    return;
  } else if (!__.contains(client.redirect_uris, req.query.redirect_uri)) {
    logger.warn('Mismatched redirect URI, expected %s got %s', client.redirect_uris, req.query.redirect_uri);
    res.render('error', { error: 'Invalid redirect URI' });
    return;
  }
  else {
    var reqScope = req.query.scope ? req.query.scope.split(' ') : undefined;
    var clientScope = client.scope ? client.scope.split(' ') : undefined;
    if (__.difference(reqScope, clientScope).length > 0) {
      logger.warn('Client %s requested a disallowed scope', client.client_id);
      var urlParsed = url.parse(req.query.redirect_uri);
      delete urlParsed.search; // this is a weird behavior of the URL library
      urlParsed.query = urlParsed.query || {};
      urlParsed.query.error = 'invalid_scope';
      res.redirect(url.format(urlParsed));
      return;
    }
    var reqid = randomstring.generate(8);
    requests[reqid] = req.query;
    res.render('approve', { client: client, reqid: reqid, scope: reqScope });
    return;
  }
});

/**
 * Process user's approval (consent).
 */
app.post('/approve', (req, res) => {
  var reqid = req.body.reqid;
  var query = requests[reqid];
  delete requests[reqid];

  if (!query) {
    var message = 'No matching authorization request found.';
    logger.error(message);
    res.render('error', { error: message });
    return;
  }

  if (req.body.approve) {
    if (query.response_type === 'code') {
      var code = randomstring.generate(8);
      var user = req.body.user;
      var scope = __.filter(__.keys(req.body), (s) => __.string.startsWith(s, 'scope_')).map((s) => s.slice('scope_'.length));
      var client = getClient(query.client_id);
      var clientScope = client.scope ? client.scope.split(' ') : undefined;
      if (__.difference(scope, clientScope).length > 0) {
        logger.warn('Client %s requested a disallowed scope: %s', client.client_id, clientScope);
        let urlParsed = url.parse(query.redirect_uri);
        delete urlParsed.search; // this is a weird behavior of the URL library
        urlParsed.query = urlParsed.query || {};
        urlParsed.query.error = 'invalid_scope';
        res.redirect(url.format(urlParsed));
        return;
      }
      codes[code] = { authorizationEndpointRequest: query, scope: scope, user: user };
      let urlParsed = url.parse(query.redirect_uri);
      delete urlParsed.search; // this is a weird behavior of the URL library
      urlParsed.query = urlParsed.query || {};
      urlParsed.query.code = code;
      urlParsed.query.state = query.state;
      logger.debug('Redirecting to: %s', url.format(urlParsed));
      res.redirect(url.format(urlParsed));
      return;
    } else {
      logger.error('Unsupported response_type: %s', query.response_type);
      let urlParsed = url.parse(query.redirect_uri);
      delete urlParsed.search; // this is a weird behavior of the URL library
      urlParsed.query = urlParsed.query || {};
      urlParsed.query.error = 'unsupported_response_type';
      res.redirect(url.format(urlParsed));
      return;
    }
  } else {
    logger.warn('User has denied access.');
    let urlParsed = url.parse(query.redirect_uri);
    delete urlParsed.search; // this is a weird behavior of the URL library
    urlParsed.query = urlParsed.query || {};
    urlParsed.query.error = 'access_denied';
    res.redirect(url.format(urlParsed));
    return;
  }
});

/**
 * Process token request.
 */
app.post('/token', (req, res) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    logger.error('Authorization header is missing.');
    res.status(401).json({ error: 'Invalid client' });
    return;
  }
  logger.debug('Authorization header found.');
  var clientCredentials = Buffer.from(authorization.slice('Basic '.length), 'base64').toString().split(':');
  var clientId = querystring.unescape(clientCredentials[0]);
  var clientSecret = querystring.unescape(clientCredentials[1]);
  var client = getClient(clientId);
  if (!client) {
    logger.error('Unknown client %s', clientId);
    res.status(401).json({ error: 'Invalid_client' });
    return;
  }
  logger.info('The client %s is valid', clientId);
  if (client.client_secret !== clientSecret) {
    logger.error('Mismatched client secret. Expected %s got %s', client.client_secret, clientSecret);
    res.status(401).json({ error: 'Invalid_client' });
    return;
  }
  logger.info('Client %s has been successfully authenticated', clientId);
  if (req.body.grant_type !== 'authorization_code') {
    logger.error('Unknown grant type %s', req.body.grant_type);
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }
  logger.info('Grant type %s is valid', req.body.grant_type);
  var code = codes[req.body.code];
  if (!code) {
    logger.error('Unknown code %s', req.body.code);
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  if (clientId !== code.authorizationEndpointRequest.client_id) {
    logger.error('Client mismatch. Expected %s got %s', code.authorizationEndpointRequest.client_id, clientId);
    res.status(400).json({ error: 'Invalid_client' });
    return;
  }
  delete codes[req.body.code]; // burn our code, it's been used.
  var access_token = randomstring.generate();
  var clientScope = code.scope ? code.scope.join(' ') : 'undefined';
  logger.debug('Issuing access token %s with scope %s', access_token, clientScope);
  var token_response = { access_token: access_token, token_type: 'Bearer', scope: clientScope };
  logger.debug('Successfully issued access token for code %s', req.body.code);
  res.status(200).json(token_response);
  return;
});

const options = {
  key: fs.readFileSync(path.join(__dirname, '../server.key')),
  cert: fs.readFileSync(path.join(__dirname, '../server.crt'))
};

const server = https.createServer(options, app);

server.listen(app.get('port'), app.get('host'), () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log(`OAuth Authorization Server listening at https://${host}:${port}/`);
});
