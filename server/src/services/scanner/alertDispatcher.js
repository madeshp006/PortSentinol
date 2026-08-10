import { alertRepository } from "../../repositories/alertRepository.js";
import { notificationRepository } from "../../repositories/notificationRepository.js";
import { sendMail } from "../../utils/mailer.js";

/**
 * Pluggable Alert Dispatcher for PortSentinel Scanner.
 * Dispatches notifications via System Alerts, Webhooks, and Email when urgent/high drift events are detected.
 */

// Provider 1: In-App System Alerts & Notifications (DB persistence)
async function sendSystemAlert({ userId, target, scanId, events }) {
  if (!userId || !events.length) return;

  const urgentCount = events.filter((e) => e.priority === "urgent").length;
  const highCount = events.filter((e) => e.priority === "high").length;
  const highestPriority = urgentCount > 0 ? "urgent" : "high";

  const title = `🚨 ${highestPriority.toUpperCase()} Security Drift Detected on ${target}`;
  const message = `${events.length} security drift event(s) detected (${urgentCount} urgent, ${highCount} high). Check scan reports for details.`;

  try {
    await alertRepository.create({
      userId,
      title,
      message,
      risk: highestPriority === "urgent" ? "critical" : "high",
      metadata: { scanId, target, events },
    });

    await notificationRepository.create({
      userId,
      title,
      message,
    });
  } catch (err) {
    console.warn("[alertDispatcher] System alert failed:", err.message);
  }
}

// Provider 2: Webhook POST Dispatcher
async function sendWebhookAlert({ target, scanId, events }) {
  const webhookUrl = process.env.DRIFT_WEBHOOK_URL;
  if (!webhookUrl || !events.length) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "PortSentinel-AlertDispatcher/1.0" },
      body: JSON.stringify({
        event: "security_drift_detected",
        target,
        scanId,
        timestamp: new Date().toISOString(),
        alertCount: events.length,
        driftEvents: events,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch (err) {
    console.warn("[alertDispatcher] Webhook dispatch failed:", err.message);
  }
}

// Provider 3: Email Notification Provider
async function sendEmailAlert({ userEmail, target, events }) {
  if (!userEmail || !events.length) return;

  const subject = `[PortSentinel Alert] Security Drift Detected for ${target}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
      <h2 style="color: #ef4444;">Security State Drift Detected</h2>
      <p>PortSentinel scanner detected <strong>${events.length} priority drift event(s)</strong> during the latest scan of target <code>${target}</code>.</p>
      <ul>
        ${events.map((e) => `<li><strong>[${e.priority.toUpperCase()}] ${e.eventType} (Port ${e.port})</strong>: ${e.explanation}</li>`).join("")}
      </ul>
      <p style="font-size: 12px; color: #64748b;">This automated alert was dispatched by PortSentinel Continuous Monitoring.</p>
    </div>
  `;

  try {
    await sendMail({ to: userEmail, subject, html });
  } catch (err) {
    console.warn("[alertDispatcher] Email dispatch failed:", err.message);
  }
}

/**
 * Main Pluggable Dispatcher
 * @param {object} scan - The completed scan object { id, userId, target, user: { email } }
 * @param {Array<object>} driftEvents - Detected drift events
 */
export async function dispatchDriftAlerts(scan = {}, driftEvents = []) {
  if (!Array.isArray(driftEvents) || driftEvents.length === 0) return;

  // Filter for priority 'urgent' or 'high'
  const urgentOrHighEvents = driftEvents.filter(
    (e) => e.priority === "urgent" || e.priority === "high"
  );

  if (urgentOrHighEvents.length === 0) return;

  console.log(`[alertDispatcher] Dispatching alerts for ${urgentOrHighEvents.length} urgent/high drift event(s) on ${scan.target}...`);

  // Run enabled channels concurrently without blocking worker thread
  await Promise.allSettled([
    sendSystemAlert({
      userId: scan.userId,
      target: scan.target,
      scanId: scan.id,
      events: urgentOrHighEvents,
    }),
    sendWebhookAlert({
      target: scan.target,
      scanId: scan.id,
      events: urgentOrHighEvents,
    }),
    sendEmailAlert({
      userEmail: scan.user?.email,
      target: scan.target,
      events: urgentOrHighEvents,
    }),
  ]);
}
