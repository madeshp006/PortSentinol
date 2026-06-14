const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

type RequestOptions = RequestInit & {
  skipJsonHeader?: boolean;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
  token?: string | null
): Promise<T> {
  const { skipJsonHeader = false, headers: incomingHeaders, ...rest } = options;
  const headers = new Headers(incomingHeaders || undefined);

  if (!skipJsonHeader && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message = typeof data === "object" && data && "error" in data
      ? String((data as { error?: string }).error)
      : `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const getApiBaseUrl = () => BASE;

export const signUp = (name: string, email: string, password: string) =>
  request<{ session: { access_token: string }; user: any; profile: any }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });

export const signIn = (email: string, password: string) =>
  request<{ session: { access_token: string }; user: any; profile: any }>("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const sendOtp = (token: string, oldPassword: string) =>
  request<{ success: boolean; email: string }>("/auth/otp/send", {
    method: "POST",
    body: JSON.stringify({ oldPassword }),
  }, token);

export const changePassword = (token: string, otpCode: string, newPassword: string) =>
  request<{ success: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ otpCode, newPassword }),
  }, token);

export const forgotPassword = (email: string) =>
  request<{ success: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (email: string, otpCode: string, newPassword: string) =>
  request<{ success: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, otpCode, newPassword }),
  });

export const getProfile = (token: string) =>
  request<any>("/profile", {}, token);

export const updateProfile = (token: string, updates: Partial<any>) =>
  request<any>("/profile", {
    method: "PUT",
    body: JSON.stringify(updates),
  }, token);

export const getScans = (token: string) =>
  request<any[]>("/scans", {}, token);

export const getScan = (token: string, id: string) =>
  request<any>(`/scans/${id}`, {}, token);

export const saveScan = (token: string, scan: any) =>
  request<any>("/scans", {
    method: "POST",
    body: JSON.stringify(scan),
  }, token);

export const deleteScan = (token: string, id: string) =>
  request<{ success: boolean }>(`/scans/${id}`, { method: "DELETE" }, token);

export const startScan = (
  token: string,
  params: { target: string; scanType: string; portRange?: string; agentId?: string }
) => request<{ scan: any; queue: any }>("/scan/start", {
  method: "POST",
  body: JSON.stringify(params),
}, token);

export const cancelScan = (token: string, id: string) =>
  request<{ success: boolean }>(`/scans/${id}/cancel`, { method: "POST" }, token);

export const getAlerts = (token: string) =>
  request<any[]>("/alerts", {}, token);

export const markAlertRead = (token: string, id: string) =>
  request<{ success: boolean }>(`/alerts/${id}/read`, { method: "PUT" }, token);

export const markAllAlertsRead = (token: string) =>
  request<{ success: boolean }>("/alerts/read-all", { method: "PUT" }, token);

export const clearAlerts = (token: string) =>
  request<{ success: boolean }>("/alerts", { method: "DELETE" }, token);

export const getSchedules = (token: string) =>
  request<any[]>("/schedules", {}, token);

export const createSchedule = (token: string, schedule: any) =>
  request<any>("/schedules", {
    method: "POST",
    body: JSON.stringify(schedule),
  }, token);

export const updateSchedule = (token: string, id: string, updates: any) =>
  request<{ success: boolean }>(`/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  }, token);

export const deleteSchedule = (token: string, id: string) =>
  request<{ success: boolean }>(`/schedules/${id}`, { method: "DELETE" }, token);

export const getAgents = (token: string) =>
  request<any[]>("/agents", {}, token);

export const deleteAgent = (token: string, id: string) =>
  request<{ success: boolean }>(`/agents/${id}`, { method: "DELETE" }, token);

export const downloadAgentZip = async (token: string): Promise<Blob> => {
  const res = await fetch(`${BASE}/agents/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to download agent ZIP");
  }
  return res.blob();
};

export const getAdminOverview = (token: string) =>
  request<any>("/admin/overview", {}, token);

