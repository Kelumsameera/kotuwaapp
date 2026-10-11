// Small fetch wrapper for our API.
// - Sends cookies and the anti-CSRF header the server requires.
// - If the access token has expired (401), refreshes once and retries.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Only one refresh runs at a time, even if many requests fail together.
let refreshInFlight = null;

// Asks the server for a new access token using the refresh cookie. Returns the user or null.
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = sendRequest("/auth/refresh", { method: "POST" })
      .then((data) => data.user)
      .catch((error) => {
        // Another tab refreshed first; its new cookies are already in the browser.
        if (error.code === "REFRESH_RACE") {
          return sendRequest("/users/me").then((data) => data.user).catch(() => null);
        }
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Sends one request and turns error responses into ApiError.
// A FormData body (file upload) is sent as-is so the browser sets the multipart headers.
async function sendRequest(path, { method = "GET", body } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = { "X-Requested-With": "kotuwa" };
  if (!isFormData) headers["Content-Type"] = "application/json";

  let requestBody = body;
  if (body !== undefined && !isFormData) requestBody = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: "same-origin", headers, body: requestBody });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data.error || {};
    throw new ApiError(response.status, error.code || "SERVER_ERROR", error.message, error.details);
  }
  return data;
}

// Calls the API. On an expired session it refreshes once and tries again.
export async function api(path, options = {}) {
  try {
    return await sendRequest(path, options);
  } catch (error) {
    const canRetry = error.status === 401 && !path.startsWith("/auth/");
    if (!canRetry) throw error;

    const user = await refreshSession();
    if (!user) throw error;
    return sendRequest(path, options);
  }
}

// Uploads one image file to an upload route (default: seller images). Returns { url, publicId }.
export async function uploadImage(file, path = "/seller/uploads/images") {
  const formData = new FormData();
  formData.append("image", file);
  const data = await api(path, { method: "POST", body: formData });
  return data.image || data.photo;
}

// Turns an ApiError into a translated message using the "errors" messages.
export function errorMessage(error, t) {
  if (error?.code === "NETWORK_ERROR") return t("errors.network");
  if (error?.code && t.has(`errors.${error.code}`)) return t(`errors.${error.code}`);
  return t("errors.generic");
}

// Turns validation details into { fieldName: message } for showing under inputs.
export function fieldErrors(error) {
  const result = {};
  for (const detail of error?.details || []) {
    if (detail.field && !result[detail.field]) result[detail.field] = detail.message;
  }
  return result;
}
