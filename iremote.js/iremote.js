var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({ port: 8080 });

var sockets = [];
var commands = 0;

function info() {
  console.log(sockets.length + ' clients connected, ' + commands + ' commands logged.');
}

var spawn = require('child_process').spawn;
var iremote = spawn('./iremotepipe');

var accum = '';

info();

iremote.stdout.on('data', function (data) {
  var command;

  accum += data;

  while (accum.match(/\n/)) {
    accum = accum.split(/\n/);

    command = accum.shift();
    accum = accum.join("\n");

    parsed = JSON.parse(command);
    if (parsed) {
      commands++;
      sockets.forEach(function (ws) {
        ws.send(command);
      });
    }

  }
});

wss.on('connection', function (ws) {
  sockets.push(ws);
  ws.on('close', function () {
    sockets.splice(sockets.indexOf(ws), 1);

    info();
  })

  info();
});