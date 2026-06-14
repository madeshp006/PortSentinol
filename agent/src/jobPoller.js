import { getConfig } from "./config.js";
import { executeScan } from "./scanner.js";
import { logger } from "./utils/logger.js";

let polling = false;

export function startJobPoller() {
  const config = getConfig();

  const pollJobs = async () => {
    if (polling) return;
    polling = true;

    try {
      const res = await fetch(`${config.serverUrl}/api/agents/${config.agentId}/jobs`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-agent-key": config.agentKey,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.warn(`Failed to poll jobs (status ${res.status}): ${errorText}`);
        polling = false;
        return;
      }

      const jobs = await res.json();
      if (Array.isArray(jobs) && jobs.length > 0) {
        logger.info(`Received ${jobs.length} pending scan jobs.`);
        for (const job of jobs) {
          logger.info(`Running job ${job.id} targeting ${job.target}...`);
          try {
            const result = await executeScan({
              target: job.target,
              scanType: job.scanType,
              portRange: job.portRange,
            });

            logger.info(`Uploading results for job ${job.id}...`);
            const uploadRes = await fetch(`${config.serverUrl}/api/agents/${config.agentId}/jobs/${job.id}/result`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-agent-key": config.agentKey,
              },
              body: JSON.stringify({ result }),
            });

            if (uploadRes.ok) {
              logger.success(`Successfully uploaded results for job ${job.id}`);
            } else {
              const uploadError = await uploadRes.text();
              logger.error(`Failed to upload results for job ${job.id}: ${uploadError}`);
            }
          } catch (scanErr) {
            logger.error(`Failed to execute job ${job.id}:`, scanErr.message);
            await fetch(`${config.serverUrl}/api/agents/${config.agentId}/jobs/${job.id}/result`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-agent-key": config.agentKey,
              },
              body: JSON.stringify({ error: scanErr.message }),
            }).catch((err) => logger.error("Failed to report job failure to server:", err.message));
          }
        }
      }
    } catch (err) {
      logger.error("Job polling request failed:", err.message);
    } finally {
      polling = false;
    }
  };

  pollJobs();
  setInterval(pollJobs, 10000);
}
