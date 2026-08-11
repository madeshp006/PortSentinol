import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import {
  startDecoyTrap,
  stopDecoyTrap,
  getActiveDecoyTraps,
  getDecoyProbeLogs,
  simulateDecoyProbe,
} from "../services/scanner/decoyEngine.js";

const router = Router();

// GET /api/decoys/status : List active decoy traps and live probe logs
router.get("/status", requireUser, (req, res) => {
  const activeTraps = getActiveDecoyTraps();
  const probeLogs = getDecoyProbeLogs();
  return res.json({
    totalActive: activeTraps.length,
    totalProbesDetected: probeLogs.length,
    activeTraps,
    probeLogs,
  });
});

// POST /api/decoys/start : Deploy a live decoy listening trap (requires explicit user consent)
router.post("/start", requireUser, async (req, res) => {
  const { type, port, targetHost, userConsent } = req.body || {};

  if (!userConsent) {
    return res.status(400).json({
      error: "Explicit user consent is required before starting live decoy trap listeners.",
    });
  }

  try {
    const result = await startDecoyTrap({ type, port, targetHost, userConsent });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/decoys/stop : Stop an active decoy trap listener
router.post("/stop", requireUser, async (req, res) => {
  const { trapId } = req.body || {};
  if (!trapId) {
    return res.status(400).json({ error: "trapId is required" });
  }

  try {
    const result = await stopDecoyTrap(trapId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/decoys/simulate-probe : Trigger a simulated probe for live demo presentations
router.post("/simulate-probe", requireUser, (req, res) => {
  const { type, port, sourceIp, attemptedUser, attemptedPass } = req.body || {};
  const hitEvent = simulateDecoyProbe({ type, port, sourceIp, attemptedUser, attemptedPass });

  return res.json({
    success: true,
    message: `Simulated probe alert fired against ${hitEvent.serviceName}`,
    probeEvent: hitEvent,
  });
});

export default router;
