import axios from "axios";
import { getAccessToken } from "../modules/auth/AuthContext";

export const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function resolveApiUrl(url?: string | null) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${apiBaseURL}${url}`;
  return `${apiBaseURL}/${url}`;
}

export const apiClient = axios.create({
  baseURL: apiBaseURL
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    if (!("Authorization" in config.headers)) {
      (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ieltslearning_access_token");
      localStorage.removeItem("ieltslearning_refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
