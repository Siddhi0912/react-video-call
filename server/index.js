// ============================================================
// index.js — WebRTC Signaling Server (Node.js + Socket.IO)
// ============================================================
// WHAT IS A SIGNALING SERVER?
//
// WebRTC lets two browsers talk DIRECTLY (peer-to-peer) for
// video/audio, but before that direct link is set up, they
// need to exchange some metadata:
//   • SDP (Session Description Protocol) — describes codecs,
//     resolution, whether to send audio/video, etc.
//   • ICE Candidates — possible network paths (IP + port combos)
//     the browsers can use to reach each other.
//
// This server's ONLY job is to relay those small messages
// between the two peers. Once the WebRTC connection is open,
// all media flows DIRECTLY between browsers — this server
// is no longer involved in the actual call.
// ============================================================

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");

const app    = express();
const server = http.createServer(app);

// Allow requests from your React dev server (localhost:3000)
const io = new Server(server, {
  cors: {
    origin: "*",   // In production, restrict this to your domain
    methods: ["GET", "POST"],
  },
});

// ── Track connected clients ──────────────────────────────────
let connectedUsers = [];

io.on("connection", (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  connectedUsers.push(socket.id);

  // ── Relay signaling messages to ALL other connected clients ──
  // The client emits { type, data } where type is:
  //   "offer"         — caller sends SDP offer
  //   "answer"        — callee sends SDP answer
  //   "ice-candidate" — either side sends a network candidate
  socket.on("signal", (payload) => {
    console.log(`📨 Signal [${payload.type}] from ${socket.id}`);

    // Broadcast to everyone EXCEPT the sender
    // In a real app you'd target a specific room/user ID
    socket.broadcast.emit("signal", payload);
  });

  // ── Cleanup on disconnect ────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    connectedUsers = connectedUsers.filter((id) => id !== socket.id);
  });
});

// ── Simple health-check endpoint ─────────────────────────────
app.get("/", (req, res) => {
  res.send(`Signaling server running. Connected clients: ${connectedUsers.length}`);
});

// ── Start the server ──────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server listening on http://localhost:${PORT}`);
});
