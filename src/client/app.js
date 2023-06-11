const express = require('express');
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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.set('appname', 'client');
app.set('json spaces', 2);
app.set('port', process.env.PORT || 9000);
app.set('host', process.env.HOST || 'localhost');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', cons.underscore);

app.use(express.static('views'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

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

var protectedResource = 'https://localhost:9002/resource';

var state = null;

var access_token = null;
var refresh_token = null;
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
  logger.debug('Requesting access token for code %s', code);
  superagent.post(authorizationServer.tokenEndpoint)
    .auth(client.client_id, client.client_secret)
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .accept('application/json')
    .send(formData)
    .then((response) => {
      access_token = response.body.access_token;
      refresh_token = response.body.refresh_token || undefined;
      scope = response.body.scope;
      logger.debug('Got access token: %s', access_token);
      res.render('index', { access_token: access_token, refresh_token: refresh_token, scope: scope });
    })
    .catch(err => {
      logger.error('Unable to fetch access token, error message: %s, server response: %s. ', err.message, err.response);
      res.render('error', { error: 'Unable to fetch access token: ' + err.response });
    });
});

/**
 * Use the access token to call the resource server.
 */
app.get('/fetch_resource', (req, res) => {
  if (!access_token) {
    logger.error('Missing access token.');
    res.render('error', { error: 'Missing access token.' });
    return;
  }
  logger.debug('Making request with access token %s', access_token);
  superagent.get(protectedResource)
    .auth(access_token, { type: 'bearer' })
    .accept('application/json')
    .then((response) => {
      res.render('data', { resource: response.body });
    })
    .catch(err => {
      logger.error('Unable to fetch resource, error message: %s, server response: %s. ', err.message, err.response);
      if (err.response && err.response.status === 401) {
        res.redirect('/authorize');
      } else {
        res.render('error', { error: 'Unable to fetch resource: ' + err.response });
      }
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
