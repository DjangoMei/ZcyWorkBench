/** Cloudflare Worker entry point for the vinext-starter template. */
import { canonicalizeBasePath } from "../app/base-path";
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const SYNC_PATH = "/zcyworkbench/api/sync";
const SYNC_FILE_PATH = `${SYNC_PATH}/file/`;
const SYNC_SESSION_PATH = `${SYNC_PATH}/session`;
const SYNC_COOKIE_NAME = "zcy_sync_session";
const SYNC_TOKEN_SHA256 =
  "10de79fc94e5eecace73154d1ba40aab8ff966f4f2b7b77101cc80ebb41e4cb1";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function json(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, {
    status,
    headers,
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthorized(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const cookieToken = (request.headers.get("Cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SYNC_COOKIE_NAME}=`))
    ?.slice(SYNC_COOKIE_NAME.length + 1);
  let decodedCookieToken = "";
  if (cookieToken) {
    try {
      decodedCookieToken = decodeURIComponent(cookieToken);
    } catch {
      decodedCookieToken = "";
    }
  }
  const token = bearerToken || decodedCookieToken;
  return token.length >= 32 && (await sha256(token)) === SYNC_TOKEN_SHA256;
}

function sessionCookie(request: Request, token: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SYNC_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/zcyworkbench; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function handleSyncSession(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return (await isAuthorized(request))
      ? json({ ok: true })
      : json({ error: "Unauthorized" }, 401);
  }

  if (request.method === "POST") {
    const authorization = request.headers.get("Authorization") || "";
    let token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    if (!token) {
      try {
        const body = (await request.json()) as { token?: unknown };
        token = typeof body.token === "string" ? body.token.trim() : "";
      } catch {
        return json({ error: "Invalid request" }, 400);
      }
    }

    const authorized =
      token.length >= 32 && (await sha256(token)) === SYNC_TOKEN_SHA256;
    if (!authorized) return json({ error: "Invalid sync key" }, 401);

    return json(
      { ok: true },
      200,
      { "Set-Cookie": sessionCookie(request, token, SESSION_MAX_AGE_SECONDS) },
    );
  }

  if (request.method === "DELETE") {
    return json(
      { ok: true },
      200,
      { "Set-Cookie": sessionCookie(request, "", 0) },
    );
  }

  return json({ error: "Method not allowed" }, 405);
}

async function ensureSyncSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS remote_state (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS remote_backups (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_remote_backups_expires_at ON remote_backups(expires_at)",
    ),
  ]);
}

function safeRemoteFileKey(url: URL): string | null {
  const encoded = url.pathname.slice(SYNC_FILE_PATH.length);
  if (!encoded) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\u0000")) {
    return null;
  }
  return `zcy-workbench/${normalized}`;
}

async function handleSync(request: Request, env: Env): Promise<Response> {
  if (!(await isAuthorized(request))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith(SYNC_FILE_PATH)) {
    const key = safeRemoteFileKey(url);
    if (!key) return json({ error: "Invalid file path" }, 400);

    if (request.method === "PUT") {
      await env.FILES.put(key, request.body, {
        httpMetadata: {
          contentType:
            request.headers.get("Content-Type") || "application/octet-stream",
        },
      });
      return json({ ok: true, key: key.slice("zcy-workbench/".length) });
    }

    if (request.method === "GET") {
      const object = await env.FILES.get(key);
      if (!object) return json({ error: "Not found" }, 404);
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "private, no-store");
      headers.set("ETag", object.httpEtag);
      return new Response(object.body, { headers });
    }

    return json({ error: "Method not allowed" }, 405);
  }

  await ensureSyncSchema(env.DB);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT payload, updated_at AS updatedAt FROM remote_state WHERE id = ?",
    )
      .bind("main")
      .first<{ payload: string; updatedAt: string }>();
    if (!row) return json({ error: "No remote data" }, 404);
    return json({ data: JSON.parse(row.payload), updatedAt: row.updatedAt });
  }

  if (request.method === "PUT") {
    const payload = await request.json();
    const serialized = JSON.stringify(payload);
    if (serialized.length > 8 * 1024 * 1024) {
      return json({ error: "Payload too large" }, 413);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + THREE_DAYS_MS).toISOString();
    const previous = await env.DB.prepare(
      "SELECT payload FROM remote_state WHERE id = ?",
    )
      .bind("main")
      .first<{ payload: string }>();

    const statements = [
      env.DB.prepare(
        `INSERT INTO remote_state (id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      ).bind("main", serialized, nowIso),
      env.DB.prepare("DELETE FROM remote_backups WHERE expires_at <= ?").bind(
        nowIso,
      ),
    ];

    if (previous) {
      statements.unshift(
        env.DB.prepare(
          "INSERT INTO remote_backups (id, payload, created_at, expires_at) VALUES (?, ?, ?, ?)",
        ).bind(crypto.randomUUID(), previous.payload, nowIso, expiresAt),
      );
    }

    await env.DB.batch(statements);
    return json({ ok: true, updatedAt: nowIso, backupCreated: Boolean(previous) });
  }

  return json({ error: "Method not allowed" }, 405);
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const canonicalPath = canonicalizeBasePath(url.pathname);

    if (canonicalPath) {
      return new Response(null, {
        status: 308,
        headers: { Location: `${canonicalPath}${url.search}` },
      });
    }

    if (
      url.pathname === SYNC_PATH ||
      url.pathname === SYNC_SESSION_PATH ||
      url.pathname.startsWith(SYNC_FILE_PATH)
    ) {
      if (url.pathname === SYNC_SESSION_PATH) {
        return handleSyncSession(request);
      }
      return handleSync(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
