import { loadConfig } from "./config.js";
import { checkAndRegisterAgent } from "./register.js";
import { startHeartbeatLoop } from "./heartbeat.js";
import { startJobPoller } from "./jobPoller.js";
import { logger } from "./utils/logger.js";

async function main() {
  logger.info("Starting PortSentinel Agent...");
  
  // Load configuration
  loadConfig();
  
  // Check registration status, register if needed
  const registered = await checkAndRegisterAgent();
  
  if (registered) {
    logger.success("PortSentinel Agent initialized and active.");
    
    // Start heartbeat loops
    startHeartbeatLoop();
    
    // Start job poller loops
    startJobPoller();
  } else {
    logger.error("Initialization failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Fatal agent error:", err.message);
  process.exit(1);
});
