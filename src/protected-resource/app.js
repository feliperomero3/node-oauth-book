const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const path = require('path');
var cons = require('consolidate');
var __ = require('underscore');
__.string = require('underscore.string');

var app = express();

app.set('appname', 'authorization-server');
app.set('json spaces', 2);
app.set('port', process.env.PORT || 9002);
app.set('host', process.env.HOST || 'localhost');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', cons.underscore);

app.use(express.static('views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index');
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
