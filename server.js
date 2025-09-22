const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

let history = [];
let currentRound = null;
let previewRound = null;

function generateTokens() {
  let tokens = [];
  for (let i = 0; i < 25; i++) {
    tokens.push(crypto.randomInt(0, 10));
  }
  return tokens;
}

function calculateResult(tokens) {
  let sum = tokens.reduce((a, b) => a + b, 0);
  return sum % 10; // Final single digit result (0-9)
}

function startRound() {
  const now = Date.now();
  const nextMinute = Math.floor(now / 60000) * 60000 + 60000;

  // Schedule preview at -35s
  setTimeout(() => {
    const tokens = generateTokens();
    const result = calculateResult(tokens);
    previewRound = { tokens, result, time: new Date() };
    broadcast({ type: "preview", result, tokens, time: previewRound.time });
  }, nextMinute - now - 35000);

  // Schedule final at 0s
  setTimeout(() => {
    if (previewRound) {
      currentRound = previewRound;
      history.unshift(currentRound);
      if (history.length > 20) history.pop();
      broadcast({ type: "final", result: currentRound.result, tokens: currentRound.tokens, time: currentRound.time, history });
      previewRound = null;
    }
    startRound();
  }, nextMinute - now);
}

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "history", history }));
  if (previewRound) ws.send(JSON.stringify({ type: "preview", result: previewRound.result, tokens: previewRound.tokens, time: previewRound.time }));
  if (currentRound) ws.send(JSON.stringify({ type: "final", result: currentRound.result, tokens: currentRound.tokens, time: currentRound.time }));
});

startRound();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
