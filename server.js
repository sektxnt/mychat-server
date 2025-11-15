const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();

// Просто чтобы по GET / видеть, что сервер жив
app.get("/", (req, res) => {
  res.send("Signaling server is running");
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// roomId -> Set of clients
const rooms = new Map();

wss.on("connection", (ws) => {
  ws.roomId = null;
  ws.nickname = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.log("Bad JSON:", data.toString());
      return;
    }

    if (msg.type === "join") {
      const { roomId, nickname } = msg;
      ws.roomId = roomId;
      ws.nickname = nickname;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(ws);

      console.log(`User ${nickname} joined room ${roomId}`);

      broadcast(roomId, {
        type: "system",
        text: `${nickname} joined`,
      });
      return;
    }

    const roomId = ws.roomId;
    if (!roomId || !rooms.has(roomId)) return;

    const payload = {
      ...msg,
      from: ws.nickname,
    };

    rooms.get(roomId).forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  });

  ws.on("close", () => {
    const roomId = ws.roomId;
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(ws);
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

function broadcast(roomId, obj) {
  if (!rooms.has(roomId)) return;
  rooms.get(roomId).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(obj));
    }
  });
}

const PORT = process.env.PORT || 8080; // ВАЖНО для Render!

server.listen(PORT, () => {
  console.log(`Signaling server on port ${PORT}`);
});
