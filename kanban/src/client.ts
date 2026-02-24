const BASE_URL = "https://board.local.gum.zone/api/v1";
let requestCounter = 0;

function debugEnabledFromEnv(): boolean {
  const value = process.env.KAN_DEBUG?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function truncateForLog(value: string, max = 1000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}... [truncated ${value.length - max} chars]`;
}

function toLogString(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return truncateForLog(value);
  try {
    return truncateForLog(JSON.stringify(value));
  } catch (error) {
    return `"[unserializable: ${error instanceof Error ? error.message : "unknown error"}]"`;
  }
}

export class KanClient {
  private debug: boolean;

  constructor(private apiKey: string) {
    this.debug = debugEnabledFromEnv();
  }

  private debugLog(message: string): void {
    if (!this.debug) return;
    console.error(`[kan-debug] ${message}`);
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const requestId = ++requestCounter;
    const startMs = Date.now();
    this.debugLog(`#${requestId} -> ${method} ${url} body=${toLogString(body)}`);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "x-api-key": this.apiKey,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      const durationMs = Date.now() - startMs;
      this.debugLog(
        `#${requestId} xx ${method} ${url} durationMs=${durationMs} error=${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }

    const durationMs = Date.now() - startMs;
    this.debugLog(
      `#${requestId} <- ${method} ${url} status=${response.status} durationMs=${durationMs} contentType=${response.headers.get("content-type") ?? "none"}`
    );

    if (!response.ok) {
      const text = await response.text();
      this.debugLog(`#${requestId} !! errorBody=${toLogString(text)}`);
      throw new Error(`Kan API ${response.status}: ${text}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      this.debugLog(`#${requestId} <- nonJsonResponse`);
      return { success: true } as T;
    }

    const json = await response.json() as T;
    this.debugLog(`#${requestId} <- responseBody=${toLogString(json)}`);
    return json;
  }

  get<T>(path: string) { return this.request<T>("GET", path); }
  post<T>(path: string, body: unknown) { return this.request<T>("POST", path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>("PUT", path, body); }
  delete<T>(path: string) { return this.request<T>("DELETE", path); }
}
