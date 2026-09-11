import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export async function getMe() {
  const r = await api.get("/auth/me");
  return r.data;
}
export async function logout() {
  await api.post("/auth/logout");
}
export async function exchangeSession(session_id) {
  const r = await api.post("/auth/session", { session_id });
  return r.data.user;
}
export async function getProfile() { return (await api.get("/profile")).data; }
export async function saveProfile(p) { return (await api.put("/profile", p)).data; }
export async function startInterview(payload) { return (await api.post("/interview/start", payload)).data; }
export async function sendInterviewMessage(payload) { return (await api.post("/interview/message", payload)).data; }
export async function endInterview(session_id) { return (await api.post(`/interview/end/${session_id}`)).data; }
export async function listSessions() { return (await api.get("/interview/sessions")).data; }
export async function analyzeSpeech(payload) { return (await api.post("/analyze/speech", payload)).data; }
export async function analyzeSARR(payload) { return (await api.post("/analyze/sarr", payload)).data; }
export async function analyzeFrame(payload) { return (await api.post("/analyze/frame", payload)).data; }
export async function generateQuestions() { return (await api.post("/questions/generate")).data; }
export async function getQuestions() { return (await api.get("/questions")).data; }
export async function listPrograms() { return (await api.get("/programs")).data; }
export async function createProgram(p) { return (await api.post("/programs", p)).data; }
export async function deleteProgram(id) { return (await api.delete(`/programs/${id}`)).data; }
export async function knowProgram(payload) { return (await api.post("/programs/know", payload)).data; }
export async function whyUs(payload) { return (await api.post("/programs/why-us", payload)).data; }
export async function progressSummary() { return (await api.get("/progress/summary")).data; }
export async function createCheckout(origin_url, lookup_key = "matchprep_pro_monthly") { return (await api.post("/payments/checkout", { origin_url, lookup_key })).data; }
export async function paymentStatus(session_id) { return (await api.get(`/payments/status/${session_id}`)).data; }

export async function ttsUrl(text, voice = "nova") {
  const r = await api.post("/tts", { text, voice }, { responseType: "blob" });
  return URL.createObjectURL(r.data);
}
export async function stt(blob) {
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  const r = await api.post("/stt", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return r.data;
}
