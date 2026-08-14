import { auth } from "./firebase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function authedFetch(path, options = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const api = {
  createStudent: (payload) =>
    authedFetch("/api/students", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateStudent: (id, payload) =>
    authedFetch(`/api/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteStudent: (id) =>
    authedFetch(`/api/students/${id}`, { method: "DELETE" }),

  createRecord: (payload) =>
    authedFetch("/api/records", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateRecord: (id, payload) =>
    authedFetch(`/api/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteRecord: (id) =>
    authedFetch(`/api/records/${id}`, { method: "DELETE" }),

  createHadithRecord: (payload) =>
    authedFetch("/api/hadith-records", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateHadithRecord: (id, payload) =>
    authedFetch(`/api/hadith-records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteHadithRecord: (id) =>
    authedFetch(`/api/hadith-records/${id}`, { method: "DELETE" }),

  createAttendance: (payload) =>
    authedFetch("/api/attendance", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAttendance: (id, payload) =>
    authedFetch(`/api/attendance/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAttendance: (id) =>
    authedFetch(`/api/attendance/${id}`, { method: "DELETE" }),

  completeKhatm: (payload) =>
    authedFetch("/api/khatmat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateListeningProgress: (payload) =>
    authedFetch("/api/listening-progress", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
