const express = require('express');
// const request = require("sync-request");
const superagent = require('superagent');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cons = require('consolidate');
const __ = require('underscore');
__.string = require('underscore.string');
const url = require("url");
const randomstring = require("randomstring");
const qs = require('qs');
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

var app = express();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.set('appname', 'client');
app.set('json spaces', 2);
app.set('port', process.env.PORT || 9000);
app.set('host', process.env.HOST || 'localhost');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', cons.underscore);

app.use(express.static('views'));

const authorizationServer = {
  authorizationEndpoint: 'https://localhost:9001/authorize',
  tokenEndpoint: 'https://localhost:9001/token'
};

const client = {
  "client_id": "oauth-client-1",
  "client_secret": "oauth-client-secret-1",
  "redirect_uris": ["https://localhost:9000/callback"],
  "scope": "foo bar"
};

var protectedResource = 'http://localhost:9002/resource';

var state = null;

var access_token = null;
var scope = null;

/**
 * Utility function that uses the JavaScript `Url` library,
 * which takes care of formatting the query parameters and URL-encoding values.
 * @param {string} baseUrl - The base url to append the parameters to.
 * @param {object} options - The parameters to append to the url.
 * @param {string} hash = The fragment to append to the url.
 * @returns The fully formed URL.
 */
var buildUrl = function(baseUrl, options, hash) {
  var newUrl = url.parse(baseUrl, true);
  delete newUrl.search;
  if (!newUrl.query) {
    newUrl = {};
  }
  __.each(options, function(value, key) {
    newUrl.query[key] = value;
  });
  if (hash) {
    newUrl.hash = hash;
  }
  return url.format(newUrl);
};

/**
 * Base64-encode client id and client secret to be used in HTTP basic authorization.
 * @param {string} clientId - The Client ID.
 * @param {*} clientSecret - The Client Secret.
 * @returns The base64-encoded string.
 */
var encodeClientCredentials = function(clientId, clientSecret) {
  return Buffer.from(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

var access_token = null;
var refresh_token = null;
var scope = null;

app.get('/', (req, res) => {
  res.render('index', { access_token: access_token, refresh_token: refresh_token, scope: scope });
});

/**
 * Send the user to the authorization server (authorization endpoint).
 */
app.get('/authorize', function(req, res) {
  state = randomstring.generate();
  var authorizeUrl = buildUrl(authorizationServer.authorizationEndpoint, {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    state: state
  });
  logger.debug("Redirecting to: %s", authorizeUrl);
  res.redirect(authorizeUrl);
});

/**
 * Parse the response from the authorization server and get a token.
 */
app.get('/callback', (req, res) => {
  if (req.query.error) {
    logger.error(message);
    res.render('error', { error: req.query.error });
    return;
  }
  if (req.query.state != state) {
    logger.error('State DOES NOT MATCH: expected %s got %s', state, req.query.state);
    res.render('error', { error: 'State value did not match.' });
    return;
  }
  var code = req.query.code;
  var formData = qs.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: client.redirect_uris[0]
  });
  var headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${encodeClientCredentials(client.client_id, client.client_secret)}`
  };
  logger.debug('Requesting access token for code %s', code);
  superagent.post(authorizationServer.tokenEndpoint)
    .set(headers)
    .accept('application/json')
    .send(formData)
    .then((response) => {
      access_token = response.body.access_token;
      refresh_token = response.body.refresh_token || undefined;
      logger.debug('Got access token: %s', access_token);
      res.render('index', { access_token: access_token, refresh_token: refresh_token, scope: scope });
    })
    .catch(err => {
      logger.error('Unable to fetch access token, error message: %s, server response: %s. ', err.message, err.response);
      res.render('error', { error: 'Unable to fetch access token: ' + err.response });
    });
});

const options = {
  key: fs.readFileSync(path.join(__dirname, '../server.key')),
  cert: fs.readFileSync(path.join(__dirname, '../server.crt'))
};

const server = https.createServer(options, app);

server.listen(app.get('port'), app.get('host'), () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log(`OAuth Client Server listening at https://${host}:${port}/`);
});
