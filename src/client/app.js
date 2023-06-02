const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
var cons = require('consolidate');

var app = express();

app.set('appname', 'client');
app.set('json spaces', 2);
app.set('port', process.env.PORT || 9000);
app.set('host', process.env.HOST || 'localhost');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', cons.underscore);

app.use(express.static('views'));

var access_token = null;
var refresh_token = null;
var scope = null;

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
