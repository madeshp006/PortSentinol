export const logger = {
  info(msg, ...args) {
    console.log(`[\x1b[36mINFO\x1b[0m] [${new Date().toLocaleTimeString()}] ${msg}`, ...args);
  },
  success(msg, ...args) {
    console.log(`[\x1b[32mOK\x1b[0m] [${new Date().toLocaleTimeString()}] ${msg}`, ...args);
  },
  warn(msg, ...args) {
    console.warn(`[\x1b[33mWARN\x1b[0m] [${new Date().toLocaleTimeString()}] ${msg}`, ...args);
  },
  error(msg, ...args) {
    console.error(`[\x1b[31mFAIL\x1b[0m] [${new Date().toLocaleTimeString()}] ${msg}`, ...args);
  },
};
