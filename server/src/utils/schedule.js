export function computeNextRun(frequency) {
  const now = new Date();
  const next = new Date(now);

  switch ((frequency || "").toLowerCase()) {
    case "daily":
      next.setDate(now.getDate() + 1);
      break;
    case "weekly":
      next.setDate(now.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(now.getMonth() + 1);
      break;
    case "every 6 hours":
      next.setHours(now.getHours() + 6);
      break;
    case "every 12 hours":
      next.setHours(now.getHours() + 12);
      break;
    default:
      next.setDate(now.getDate() + 1);
      break;
  }

  return next.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
