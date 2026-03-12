import "dotenv/config";
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
