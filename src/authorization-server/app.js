import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

/* jshint -W024 */
const dirname = path.dirname(fileURLToPath(import.meta.url));
/* jshint +W024 */

const options = {
  key: fs.readFileSync(path.join(dirname, '../server.key')),
  cert: fs.readFileSync(path.join(dirname, '../server.crt'))
};

var app = express();

app.set('appname', 'authorization-server');
app.set('port', process.env.PORT || 9001);
app.set('host', process.env.HOST || 'localhost');
app.set('view engine', 'html');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = https.createServer(options, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

server.listen(app.get('port'), app.get('host'), () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log(`Server listening at https://${host}:${port}/`);
});
