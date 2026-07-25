import pino from "pino";
import fs from "fs";
import path from "path";
import util from "util";
import { Writable } from "stream";

const PROCESS_PROFILE = process.env.PROCESS_PROFILE || "COMBINED";

// Ensure logs directory exists
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Generate timestamped log filename: server-YYYY-MM-DD_HH-mm-ss.log
const now = new Date();
const pad = (n: number) => n.toString().padStart(2, "0");
const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
export const currentLogFilePath = path.join(logDir, `server-${timestampStr}.log`);

// Synchronous file destination to ensure real-time writing without buffer loss on exit
const fileStream = pino.destination({
  dest: currentLogFilePath,
  sync: true,
  mkdir: true,
});

function formatLogLine(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    const timestamp = obj.time || new Date().toISOString();
    const level = (obj.level || "INFO").toString().toUpperCase();
    const msg = obj.msg !== undefined ? obj.msg : "";
    const { level: _l, time: _t, msg: _m, profile: _p, env: _e, ...rest } = obj;
    const extra = Object.keys(rest).length > 0 ? " " + JSON.stringify(rest) : "";
    return `[${timestamp}] [${level}] ${msg}${extra}\n`;
  } catch {
    const trimmed = raw.trimEnd();
    if (!trimmed) return "\n";
    if (!trimmed.startsWith("[")) {
      return `[${new Date().toISOString()}] [INFO] ${trimmed}\n`;
    }
    return trimmed + "\n";
  }
}

// Custom writable wrapper to format Pino JSON chunks into [TIMESTAMP] [LEVEL] text format
const pinoFileStreamWrapper = new Writable({
  write(chunk, _encoding, callback) {
    try {
      const formatted = formatLogLine(chunk.toString());
      fileStream.write(formatted);
    } catch {}
    callback();
  }
});

const pinoStdoutWrapper = new Writable({
  write(chunk, _encoding, callback) {
    try {
      const formatted = formatLogLine(chunk.toString());
      process.stdout.write(formatted);
    } catch {}
    callback();
  }
});

// Configure multi-stream destination for Pino: stdout + timestamped file
const streams = [
  { stream: pinoStdoutWrapper },
  { stream: pinoFileStreamWrapper },
];

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    base: {
      profile: PROCESS_PROFILE,
      env: process.env.NODE_ENV || "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
  },
  pino.multistream(streams)
);

// Intercept standard console methods so all console.log/error/warn calls across the app write to both console and the log file
const origConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

function writeConsoleToFile(level: string, args: any[]) {
  try {
    const formattedMsg = util.format(...args);
    const lines = formattedMsg.split(/\r?\n/);
    const timestamp = new Date().toISOString();
    const formattedLines = lines.map(line => line.trim() ? `[${timestamp}] [${level}] ${line}` : "").filter(Boolean).join("\n") + "\n";
    if (formattedLines.trim()) {
      fileStream.write(formattedLines);
    }
  } catch {
    // Ignore logging errors to prevent recursive loops
  }
}

console.log = (...args: any[]) => {
  origConsole.log.apply(console, args);
  writeConsoleToFile("INFO", args);
};

console.error = (...args: any[]) => {
  origConsole.error.apply(console, args);
  writeConsoleToFile("ERROR", args);
};

console.warn = (...args: any[]) => {
  origConsole.warn.apply(console, args);
  writeConsoleToFile("WARN", args);
};

console.info = (...args: any[]) => {
  origConsole.info.apply(console, args);
  writeConsoleToFile("INFO", args);
};

console.debug = (...args: any[]) => {
  origConsole.debug.apply(console, args);
  writeConsoleToFile("DEBUG", args);
};

// Helper for bootstrap sequences
export const sysLog = {
  info: (msg: string, mergObj?: object) => logger.info(mergObj || {}, msg),
  warn: (msg: string, mergObj?: object) => logger.warn(mergObj || {}, msg),
  error: (msg: string, err?: any, mergObj?: object) => {
    const errObj = err instanceof Error ? { error: { message: err.message, stack: err.stack } } : { error: err };
    logger.error({ ...errObj, ...(mergObj || {}) }, msg);
  },
  debug: (msg: string, mergObj?: object) => logger.debug(mergObj || {}, msg),
};

export default logger;


