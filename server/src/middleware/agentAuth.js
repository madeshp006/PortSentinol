import { agentRepository } from "../repositories/agentRepository.js";

export async function agentAuth(req, res, next) {
  const apiKey = req.headers["x-agent-key"] || req.query.agentKey;

  if (!apiKey) {
    return res.status(401).json({ error: "Agent API Key required (x-agent-key header)" });
  }

  try {
    const agent = await agentRepository.findByApiKey(apiKey);
    if (!agent) {
      return res.status(401).json({ error: "Invalid Agent API Key" });
    }

    req.agent = agent;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Internal agent authorization error: " + err.message });
  }
}
