/**
 * Winston logger configured for the MCP Server.
 *
 * Outputs structured JSON in production and colourised text during
 * development, controlled by the LOG_LEVEL environment variable.
 */

import winston from "winston";
import config from "../config.js";

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), json());

const isProduction = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: config.logLevel,
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: config.serverName },
  transports: [new winston.transports.Console()],
});

export default logger;
