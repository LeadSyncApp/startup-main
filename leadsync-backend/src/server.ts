import "dotenv/config";
// Capture unhandled promise rejections early so the server doesn't crash silently
process.on("unhandledRejection", (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

import http from "http";
import app from "./app";
import { initSocket } from "./lib/socket";
import { startAutomationRunner } from "./services/automation.service";

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 LeadSync backend listening on port ${PORT}`);
  startAutomationRunner();
});
