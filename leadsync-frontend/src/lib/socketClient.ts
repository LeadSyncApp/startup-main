import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let notificationListener: ((notification: any) => void) | null = null;
let connectedUserId: string | null = null;

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s

/**
 * Connect to the backend Socket.IO server, register the user,
 * and start the heartbeat cycle.
 *
 * Passes the auth token via socket handshake so the server's io.use
 * middleware can verify the JWT before any events are processed.
 */
export function connectSocket(userId: string, companyId: string, token: string, userName?: string) {
  // Don't re-connect if already connected for this user
  if (socket?.connected && connectedUserId === userId) return;

  disconnectSocket();
  connectedUserId = userId;

  socket = io(window.location.origin, {
    transports: ["websocket", "polling"],
    auth: {
      token, // passed to io.use middleware for JWT verification
    },
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket!.id);

    // 1. Register user — joins user:{userId} room, starts online tracking
    //    The server derives userId from the verified JWT, ignoring our payload.
    socket!.emit("register_user", { userId, companyId, userName });

    // 2. Also join company room for potential company-wide broadcasts
    socket!.emit("join_company", companyId);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] Connection error:", err.message);
  });

  // Start heartbeat interval
  heartbeatInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit("heartbeat");
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Set up notification listener
  if (notificationListener) {
    socket.on("notification_new", notificationListener);
  }
}

/**
 * Register a callback for incoming notification_new events.
 * Must be called BEFORE connectSocket to catch events from the start,
 * or can be called anytime (listener is swapped dynamically).
 */
export function onNotification(callback: (notification: any) => void) {
  notificationListener = callback;
  if (socket) {
    socket.off("notification_new");
    socket.on("notification_new", callback);
  }
}

/**
 * Disconnect the socket and clear heartbeat interval.
 */
export function disconnectSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance (useful for debugging).
 */
export function getSocket() {
  return socket;
}