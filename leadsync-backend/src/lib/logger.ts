import pino from "pino";

const PROCESS_PROFILE = process.env.PROCESS_PROFILE || "COMBINED";

export const logger = pino({
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
});

// A helper to replace global console statements during bootstrap sequences cleanly
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
