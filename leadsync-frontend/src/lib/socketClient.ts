import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let notificationListener: ((notification: any) => void) | null = null;
let connectedUserId: string | null = null;

// Registry of generic event listeners so components can subscribe even before
// the socket is connected. Handlers are (re)attached on every (re)connection.
const eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

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

  const socketTarget = (import.meta.env.VITE_SOCKET_URL as string) ||
    (typeof window !== "undefined" && window.location.origin.includes(":5173")
      ? "http://localhost:4000"
      : window.location.origin);

  socket = io(socketTarget, {
    transports: ["websocket", "polling"],
    auth: {
      token, // passed to io.use middleware for JWT verification
    },
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket!.id);

    // (Re)attach any generic listeners registered before connect.
    eventListeners.forEach((handlers, event) => {
      handlers.forEach((handler) => socket!.on(event, handler));
    });

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

/**
 * Subscribe to a socket event. Safe to call before the socket is connected:
 * the handler is stored and (re)attached automatically on connect/reconnect.
 * Returns an unsubscribe function.
 */
export function onEvent(event: string, handler: (payload: any) => void): () => void {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event)!.add(handler);
  if (socket) socket.on(event, handler);
  return () => offEvent(event, handler);
}

/**
 * Unsubscribe a previously registered socket event handler.
 */
export function offEvent(event: string, handler: (payload: any) => void) {
  const handlers = eventListeners.get(event);
  if (handlers) {
    handlers.delete(handler);
    if (handlers.size === 0) eventListeners.delete(event);
  }
  if (socket) socket.off(event, handler);
}