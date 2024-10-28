const compact = require('lodash/compact');
const isError = require('lodash/isError');
const get = require('lodash/get');
const winston = require('winston');

const { format: filterFormat, transports } = winston;
const isDev = true;

const devTransports = compact([
  new transports.File({
    filename: 'logs/warn.log',
    level: 'warn',
  }),
  new transports.File({
    filename: 'logs/info.log',
    level: 'info',
  }),
  new transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new transports.File({
    filename: 'logs/debug.log',
    level: 'debug',
  }),
  new transports.File({
    filename: 'logs/combined.log',
    handleExceptions: true,
  }),
  new transports.Console({
    level: 'debug',
    format: filterFormat.combine(
      filterFormat.colorize(),
      filterFormat.printf(info => {
        const message = isError(get(info, 'message'))
          ? get(info, 'message.stack')
          : get(info, 'message');
        return `${info.timestamp} ${info.level}: ${message}`;
      }),
    ),
  }),
]);

const prodTransports = [
  new transports.File({
    filename: 'logs/combined.log',
    handleExceptions: true,
  }),
  new transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new transports.Console({
    level: 'error',
    format: filterFormat.combine(
      filterFormat.colorize(),
      filterFormat.printf(info => {
        const message = isError(get(info, 'message'))
          ? get(info, 'message.stack')
          : get(info, 'message');
        return `${info.timestamp} ${info.level}: ${message}`;
      }),
    ),
  }),
];

const envTransports = isDev ? devTransports : prodTransports;

const devFormats = [
  filterFormat.timestamp({ format: 'MM-DD HH:mm:ss' }),
  filterFormat.printf(info => {
    const message = isError(get(info, 'message'))
      ? get(info, 'message.stack')
      : get(info, 'message');
    return `${info.timestamp} ${info.level}: ${message}`;
  }),
];

const prodFormats = [
  filterFormat.colorize(),
  filterFormat.splat(),
  filterFormat.timestamp({ format: 'MM-DD HH:mm:ss' }),
  filterFormat.simple(),
  filterFormat.printf(info => {
    const message = isError(get(info, 'message'))
      ? get(info, 'message.stack')
      : get(info, 'message');
    return `${info.timestamp} ${info.level}: ${message}`;
  }),
];

const format = isDev
  ? filterFormat.combine(...devFormats)
  : filterFormat.combine(...prodFormats);

winston.addColors({
  info: 'green',
});

const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
  },
  format,
  transports: envTransports,
});

// eslint-disable-next-line no-console
logger.on('error', error => console.error('logger:error', error));

process.on('SIGINT', () => {
  logger.log('error', `SIGINT, exit`);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  logger.log('error', `unhandled rejection, ${error || 'unknown'}, exit`);
  process.exit(1);
});

process.on('rejectionHandled', error => {
  logger.log('error', `rejection handled, ${error || 'unknown'}, exit`);
  process.exit(1);
});

process.on('multipleResolves', (type, promise, reason) => {
  logger.log(
    'error',
    `multiple resolves, type: ${type}, reason: ${reason ||
      'unknown'}, promise: ${JSON.stringify(promise)}`,
  );
});

process.on('uncaughtException', error => {
  logger.log('error', `uncaught exception, ${error.stack || 'unknown'}`);
});

module.exports = {
  log: (level, message) => {
    const logMessage = isError(message) ? message.stack : message;
    logger.log(level, logMessage);
  },
};
