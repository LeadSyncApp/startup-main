import "dotenv/config";
import http from "http";
import app from "./app";
import { initSocket } from "./lib/socket";

const PORT = process.env.PORT || 4000;

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 LeadSync backend listening on port ${PORT}`);
});
