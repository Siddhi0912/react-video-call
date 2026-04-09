// ============================================================
// App.js — WebRTC Video Call Frontend (React + Socket.IO)
// ============================================================
// HOW IT WORKS (Big Picture):
//  1. Both users open the app in separate browser tabs/machines.
//  2. Each user clicks "Start Camera" to access their webcam/mic.
//  3. One user clicks "Call" — this creates an SDP "offer" and
//     sends it to the other user via the Socket.IO signaling server.
//  4. The other user receives the offer and sends back an "answer".
//  5. ICE candidates (network info) are exchanged to find the
//     best peer-to-peer path.
//  6. Video/audio streams flow directly between browsers (P2P).
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// ----- CONFIG -----------------------------------------------
// Change this to your server's URL when deploying
const SIGNALING_SERVER = "http://localhost:4000";

// STUN servers help discover your public IP for peer connection
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
// ------------------------------------------------------------

export default function App() {
  // --- Refs (hold values that don't trigger re-renders) ---
  const localVideoRef  = useRef(null); // <video> element for YOUR camera
  const remoteVideoRef = useRef(null); // <video> element for the OTHER person
  const pcRef          = useRef(null); // RTCPeerConnection instance
  const socketRef      = useRef(null); // Socket.IO connection

  // --- State (triggers re-renders when changed) ---
  const [status, setStatus]       = useState("idle");      // idle | ready | calling | connected
  const [cameraOn, setCameraOn]   = useState(false);
  const [isMuted, setIsMuted]     = useState(false);
  const [localStream, setLocalStream] = useState(null);

  // ── Step 1: Connect to the signaling server on mount ──────
  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER);

    // Listen for signaling messages from the server
    socketRef.current.on("signal", handleSignal);

    // Cleanup when component unmounts
    return () => {
      socketRef.current.disconnect();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  // ── Step 2: Handle incoming signaling messages ────────────
  // Signaling is just exchanging metadata — no media flows here.
  async function handleSignal({ type, data }) {
    const pc = pcRef.current;
    if (!pc) return;

    if (type === "offer") {
      // Someone called us — set their SDP as the remote description
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      // Create an answer and send it back
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("signal", { type: "answer", data: answer });
      setStatus("connected");
    }

    if (type === "answer") {
      // Our call was accepted — set the answer as remote description
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      setStatus("connected");
    }

    if (type === "ice-candidate") {
      // Add received ICE candidate (network path info)
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    }
  }

  // ── Step 3: Access camera & microphone ───────────────────
  async function startCamera() {
    try {
      // Ask the browser for camera + microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Show your own video (muted to avoid echo)
      localVideoRef.current.srcObject = stream;
      setLocalStream(stream);
      setCameraOn(true);
      setStatus("ready");

      // ── Create the RTCPeerConnection ──────────────────────
      // This is the core WebRTC object that manages the P2P connection
      pcRef.current = new RTCPeerConnection(ICE_SERVERS);

      // Add all your local tracks (video + audio) to the connection
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });

      // When we discover a new ICE candidate, send it to peer via server
      pcRef.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socketRef.current.emit("signal", {
            type: "ice-candidate",
            data: candidate,
          });
        }
      };

      // When the remote peer's media stream arrives, show it
      pcRef.current.ontrack = ({ streams }) => {
        if (streams[0]) {
          remoteVideoRef.current.srcObject = streams[0];
          setStatus("connected");
        }
      };

      // Log connection state changes (for debugging)
      pcRef.current.onconnectionstatechange = () => {
        console.log("Connection state:", pcRef.current.connectionState);
      };
    } catch (err) {
      console.error("Camera access error:", err);
      setStatus("error");
      alert("Could not access camera/microphone. Check permissions.");
    }
  }

  // ── Step 4: Initiate a call (create & send offer) ────────
  async function startCall() {
    if (!pcRef.current) return alert("Start your camera first!");

    setStatus("calling");

    // Create an SDP offer — describes our media capabilities
    const offer = await pcRef.current.createOffer();

    // Set it as our local description
    await pcRef.current.setLocalDescription(offer);

    // Send the offer to the other peer via the signaling server
    socketRef.current.emit("signal", { type: "offer", data: offer });
  }

  // ── Toggle microphone on/off ──────────────────────────────
  function toggleMute() {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }

  // ── Toggle camera on/off ──────────────────────────────────
  function toggleCamera() {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCameraOn((prev) => !prev);
  }

  // ── Status label helper ───────────────────────────────────
  const statusLabel = {
    idle:      "● Waiting — start your camera",
    ready:     "● Camera ready — you can call",
    calling:   "◌ Calling... waiting for peer",
    connected: "● Connected",
    error:     "✕ Error accessing camera",
  }[status];

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <h1 style={styles.title}>WebRTC Video Call</h1>
        <span style={{ ...styles.badge, color: status === "connected" ? "#4ade80" : status === "error" ? "#f87171" : "#facc15" }}>
          {statusLabel}
        </span>
      </header>

      {/* ── Video Grid ── */}
      <div style={styles.videoGrid}>
        {/* Your local video — muted to prevent echo */}
        <div style={styles.videoWrapper}>
          <span style={styles.videoLabel}>You</span>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted               // ← always mute local video
            style={styles.video}
          />
        </div>

        {/* Remote peer's video */}
        <div style={styles.videoWrapper}>
          <span style={styles.videoLabel}>Remote</span>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={styles.video}
          />
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={styles.controls}>
        {!localStream ? (
          <button onClick={startCamera} style={{ ...styles.btn, background: "#3b82f6" }}>
            📷 Start Camera
          </button>
        ) : (
          <>
            <button onClick={startCall} style={{ ...styles.btn, background: "#22c55e" }} disabled={status === "connected"}>
              📞 Call
            </button>
            <button onClick={toggleMute} style={{ ...styles.btn, background: isMuted ? "#ef4444" : "#6b7280" }}>
              {isMuted ? "🔇 Unmute" : "🎤 Mute"}
            </button>
            <button onClick={toggleCamera} style={{ ...styles.btn, background: cameraOn ? "#6b7280" : "#ef4444" }}>
              {cameraOn ? "📷 Cam Off" : "📷 Cam On"}
            </button>
          </>
        )}
      </div>

      {/* ── Instructions ── */}
      <p style={styles.hint}>
        Open this page in <strong>two browser tabs</strong> (or two machines on the same network).
        Both start their cameras, then one clicks <em>Call</em>.
      </p>
    </div>
  );
}

// ── Inline Styles ─────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f1f5f9",
    fontFamily: "'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 16px",
    gap: "20px",
  },
  header: { textAlign: "center" },
  title: { margin: 0, fontSize: "1.8rem", letterSpacing: "0.05em" },
  badge: { fontSize: "0.85rem", opacity: 0.9 },
  videoGrid: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  videoWrapper: {
    position: "relative",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#1e293b",
    border: "1px solid #334155",
  },
  videoLabel: {
    position: "absolute",
    top: "8px",
    left: "12px",
    fontSize: "0.75rem",
    background: "rgba(0,0,0,0.5)",
    padding: "2px 8px",
    borderRadius: "999px",
    zIndex: 1,
  },
  video: {
    width: "400px",
    maxWidth: "90vw",
    height: "300px",
    objectFit: "cover",
    display: "block",
    background: "#000",
  },
  controls: { display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" },
  btn: {
    padding: "10px 22px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: "600",
    transition: "opacity 0.2s",
  },
  hint: {
    fontSize: "0.82rem",
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: "480px",
    lineHeight: 1.6,
  },
};
