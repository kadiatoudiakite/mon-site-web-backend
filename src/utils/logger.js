const levels = { error: 0, warn: 1, info: 2, debug: 3 };

// Determine current logging level (default to 'info' if not set or invalid)
const currentLevel = (() => {
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && levels[envLevel] !== undefined) {
    return levels[envLevel];
  }
  return levels['info'];
})();

function log(level, ...args) {
  if (levels[level] <= currentLevel) {
    const prefix = `[${level.toUpperCase()}]`;
    console.log(prefix, ...args);
  }
}

// Helper shortcuts for the most common log levels
const error = (...args) => log('error', ...args);
const warn = (...args) => log('warn', ...args);
const info = (...args) => log('info', ...args);
const debug = (...args) => log('debug', ...args);

module.exports = { log, error, warn, info, debug };
