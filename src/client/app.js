const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
var cons = require('consolidate');
var __ = require('underscore');
__.string = require('underscore.string');
var url = require("url");
var randomstring = require("randomstring");

var app = express();

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

/**
 * Utility function that uses the JavaScript `Url` library,
 * which takes care of formatting the query parameters and URL-encoding values.
 * @param {string} baseUrl - The base url to append the parameters to.
 * @param {object} options - The parameters to append to the url.
 * @param {string} hash = The fragment to append to the url.
 * @returns
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

var access_token = null;
var refresh_token = null;
var scope = null;

app.get('/authorize', function(req, res) {
  var state = randomstring.generate();
  var authorizeUrl = buildUrl(authorizationServer.authorizationEndpoint, {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    state: state
  });
  console.log("redirect", authorizeUrl);
  res.redirect(authorizeUrl);
});

app.get('/', (req, res) => {
  res.render('index', { access_token: access_token, refresh_token: refresh_token, scope: scope });
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
