# WebRTC Video Call App — Setup Instructions

## Project Structure

```
webrtc-app/
├── server/
│   ├── index.js          ← Node.js signaling server
│   └── package.json
└── client/
    ├── src/
    │   └── App.js        ← React frontend
    └── package.json
```

---

## Step 1 — Set Up the Signaling Server

```bash
# Create server folder
mkdir webrtc-app && cd webrtc-app
mkdir server && cd server

# Initialize and install dependencies
npm init -y
npm install express socket.io
```

Copy `index.js` into the `server/` folder, then:

```bash
node index.js
# ✅ Output: Signaling server listening on http://localhost:4000
```

---

## Step 2 — Set Up the React Frontend

Open a **new terminal**:

```bash
# From the webrtc-app/ root
npx create-react-app client
cd client
npm install socket.io-client
```

Replace `src/App.js` with the provided `App.js` file.

Then start the React app:

```bash
npm start
# ✅ Opens http://localhost:3000
```

---

## Step 3 — Test the Call

1. Open **http://localhost:3000** in **Tab 1** (or Browser 1)
2. Open **http://localhost:3000** in **Tab 2** (or Browser 2)
3. In **both tabs**: click **"📷 Start Camera"** — allow browser permissions
4. In **one tab**: click **"📞 Call"**
5. The remote video should appear in both tabs within seconds ✅

---

## How It Works (Flow Diagram)

```
Browser A                  Server               Browser B
   |                          |                      |
   |── Start Camera ──────────|                      |
   |                          |── Start Camera ──────|
   |                          |                      |
   |── emit("offer") ────────►|                      |
   |                          |── emit("offer") ────►|
   |                          |                      |
   |                          |◄─ emit("answer") ────|
   |◄─ emit("answer") ────────|                      |
   |                          |                      |
   |── emit("ice-candidate") ►|─────────────────────►|
   |◄─────────────────────────|◄─ emit("ice-candidate")|
   |                          |                      |
   |◄════════ P2P Video/Audio Stream ════════════════|
   |  (server no longer involved in media!)           |
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Camera not showing | Allow browser camera permissions; use HTTPS in production |
| Remote video blank | Make sure BOTH users clicked "Start Camera" before calling |
| Connection fails | Check that the signaling server is running on port 4000 |
| CORS error | Ensure `SIGNALING_SERVER` in App.js matches your server URL |
| Works locally, not remotely | Add a TURN server (e.g., Twilio, coturn) for NAT traversal |

---

## Production Notes

- **HTTPS is required** for `getUserMedia` in production (browsers block camera on HTTP)
- Add a **TURN server** for connections across different networks/firewalls
- The current signaling server broadcasts to ALL connected clients — add rooms for multi-user support
- Consider [simple-peer](https://github.com/feross/simple-peer) to simplify WebRTC boilerplate

---

## Dependencies Summary

**Server:**
- `express` — HTTP server
- `socket.io` — WebSocket signaling

**Client:**
- `react` — UI framework
- `socket.io-client` — Connect to signaling server
