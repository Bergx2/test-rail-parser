const compact = require('lodash/compact');
const winston = require('winston');
const bottleneck = require('bottleneck');

const { format: filterFormat, transports } = winston;
// const isDev = process.env.NODE_ENV === 'development';
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
    // Add console transport
    level: 'debug', // Adjust level based on what you want to see in console
    format: filterFormat.combine(
      filterFormat.colorize(),
      filterFormat.printf(
        info => `${info.timestamp} ${info.level}: ${info.message}`,
      ),
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
    // Add console transport
    level: 'error', // Only log errors to console in production
    format: filterFormat.combine(
      filterFormat.colorize(),
      filterFormat.printf(
        info => `${info.timestamp} ${info.level}: ${info.message}`,
      ),
    ),
  }),
];

const envTransports = isDev ? devTransports : prodTransports;

const devFormats = [
  filterFormat.timestamp({ format: 'MM-DD HH:mm:ss' }),
  filterFormat.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
];

const prodFormats = [
  filterFormat.colorize(),
  filterFormat.splat(),
  filterFormat.timestamp({ format: 'MM-DD HH:mm:ss' }),
  filterFormat.simple(),
  filterFormat.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
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

const bottleneckInstance = new bottleneck.default({
  maxConcurrent: 1,
  minTime: 5,
});

// Handle logger errors separately
logger.on('error', error => console.error('logger:error', error));

// Process Events
const limiter = new bottleneck.default({
  minTime: 1000,
});

process.on('SIGINT', () => {
  limiter
    .schedule({}, () => logger.log('error', `SIGINT, exit`))
    .then(() => process.exit(1));
});
process.on('unhandledRejection', error => {
  limiter
    .schedule({}, () =>
      logger.log('error', `unhandled rejection, ${error || 'unknown'}, exit`),
    )
    .then(() => process.exit(1));
});
process.on('rejectionHandled', error => {
  limiter
    .schedule({}, () =>
      logger.log('error', `rejection handled, ${error || 'unknown'}, exit`),
    )
    .then(() => process.exit(1));
});
process.on('multipleResolves', (type, promise, reason) => {
  logger.log(
    'error',
    `multiple resolves, type: ${type}, reason: ${reason ||
      'unknown'}, promise: ${JSON.stringify(promise)}`,
  );
});
process.on('uncaughtException', error => {
  logger.log('error', `uncaught exception, ${error || 'unknown'}`);
});

module.exports = {
  log: (level, message) => {
    bottleneckInstance.schedule({}, () =>
      Promise.resolve(logger.log(level, message)),
    );
  },
};
