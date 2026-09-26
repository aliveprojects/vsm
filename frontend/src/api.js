const API = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return data;
}

export const api = {
  users: () => request("/users"),
  user: (id) => request(`/users/${id}`),
  analytics: (id) => request(`/users/${id}/analytics`),
  scenarios: () => request("/scenarios"),
  leaderboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/leaderboard${q ? `?${q}` : ""}`);
  },
  notifications: (userId) => request(`/notifications/${userId}`),
  readNotifications: (userId) =>
    request(`/notifications/${userId}/read`, { method: "POST", body: "{}" }),
  startSession: (userId, scenarioId) =>
    request("/sessions", {
      method: "POST",
      body: JSON.stringify({ userId, scenarioId }),
    }),
  choose: (sessionId, choiceId) =>
    request(`/sessions/${sessionId}/choose`, {
      method: "POST",
      body: JSON.stringify({ choiceId }),
    }),
  timeout: (sessionId) =>
    request(`/sessions/${sessionId}/timeout`, { method: "POST", body: "{}" }),
  scenarioDetail: (id) => request(`/scenarios/${id}`),
  addChoice: (scenarioId, payload) =>
    request(`/scenarios/${scenarioId}/choices`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetUser: (id) => request(`/users/${id}/reset`, { method: "POST", body: "{}" }),
  hrExport: (id) => request(`/integrations/hr/export/${id}`),
};
