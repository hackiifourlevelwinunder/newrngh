// server.js
const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

let currentResult = null;
let previewResult = null;
let roundStart = Date.now();
const roundDuration = 60000; // 60 seconds
let history = [];

// ✅ Generate CSPRNG 0-9
function generateCSPRNG() {
  const buf = crypto.randomBytes(1);
  return buf[0] % 10;
}

// ✅ Generate 25 tokens and make final result
function generateResult() {
  let tokens = [];
  for (let i = 0; i < 25; i++) {
    tokens.push(generateCSPRNG());
  }
  const sum = tokens.reduce((a, b) => a + b, 0);
  return { tokens, final: sum % 10 };
}

// ✅ Update results every round
function updateRound() {
  const now = Date.now();
  const elapsed = now - roundStart;

  if (elapsed >= roundDuration) {
    // Round complete → final result lock karo
    if (previewResult) {
      currentResult = previewResult;
      history.unshift(currentResult);
      if (history.length > 50) history.pop();
    }

    // New preview banado for next round
    previewResult = generateResult();
    roundStart = now;
  }
}

// ✅ WebSocket clients update
setInterval(() => {
  updateRound();
  const remaining = roundDuration - (Date.now() - roundStart);

  let data = {
    time: new Date().toLocaleTimeString(),
    countdown: Math.max(0, Math.floor(remaining / 1000)),
    preview: null,
    final: null,
    history: history,
  };

  // Preview result 35 sec pehle show ho
  if (remaining <= 25000 && previewResult) {
    data.preview = previewResult;
  }

  // Final result show ho jab round complete ho
  if (remaining === 0 && currentResult) {
    data.final = currentResult;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
