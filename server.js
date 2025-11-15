const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Signaling server OK');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  return rooms.get(roomId);
}

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.nickname = 'anon';

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }

    if (msg.type === 'join') {
      ws.nickname = msg.nickname || 'anon';
      ws.roomId = msg.roomId || 'room1';

      const room = getRoom(ws.roomId);
      room.add(ws);

      room.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'system',
            text: `${ws.nickname} подключился`
          }));
        }
      });

      return;
    }

    const room = rooms.get(ws.roomId);
    if (!room) return;

    room.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN || client === ws) return;

      client.send(JSON.stringify({
        ...msg,
        from: ws.nickname,
      }));
    });
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log('Signaling server listening on port', PORT);
});
