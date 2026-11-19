const SESSION_COOKIE = "portfolio_session";
const SESSION_DAYS = 7;
const INVITATION_HOURS = 72;
const PASSWORD_ITERATIONS = 120000;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

const cleanEmail = (email) => email.trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const now = () => new Date().toISOString();
const expiresIn = (milliseconds) => new Date(Date.now() + milliseconds).toISOString();

const toHex = (bytes) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const digest = async (value) => toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const derivePassword = async (password, salt) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
};

const secureEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const readCookie = (request, name) => {
  const cookies = request.headers.get("Cookie") || "";
  const entry = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
};

const cookieHeader = (request, value, maxAge) => {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

const clearCookie = (request) => cookieHeader(request, "", 0);

const requireSameOrigin = (request) => {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
};

const getSession = async (request, env) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  return env.DB.prepare(
    `SELECT profiles.id, profiles.email, profiles.display_name, profiles.role, profiles.status
     FROM sessions
     JOIN profiles ON profiles.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND profiles.status = 'active'`,
  ).bind(await digest(token), now()).first();
};

const createSession = async (request, env, userId) => {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await digest(token), userId, expiresIn(SESSION_DAYS * 24 * 60 * 60 * 1000))
    .run();
  return cookieHeader(request, token, SESSION_DAYS * 24 * 60 * 60);
};

const requireUser = async (request, env) => {
  const user = await getSession(request, env);
  if (!user) return { response: json({ error: "Sesi tidak valid atau sudah berakhir. Silakan login kembali." }, 401) };
  return { user };
};

const requireAdmin = async (request, env) => {
  const result = await requireUser(request, env);
  if (result.response) return result;
  if (result.user.role !== "admin" || result.user.status !== "active") {
    return { response: json({ error: "Akses admin diperlukan." }, 403) };
  }
  return result;
};

const handleSetup = async (request, env) => {
  if (request.method !== "POST") return json({ error: "Metode tidak diizinkan." }, 405);
  if (!env.SETUP_TOKEN) return json({ error: "Token setup belum dikonfigurasi di Worker." }, 503);
  const suppliedToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secureEqual(suppliedToken, env.SETUP_TOKEN)) return json({ error: "Token setup tidak valid." }, 401);

  const existingAdmin = await env.DB.prepare("SELECT id FROM profiles WHERE role = 'admin' LIMIT 1").first();
  if (existingAdmin) return json({ error: "Admin sudah dibuat. Endpoint setup hanya dapat digunakan sekali." }, 409);

  const payload = await readJson(request);
  if (!payload) return json({ error: "Body harus berupa JSON yang valid." }, 400);
  const email = typeof payload.email === "string" ? cleanEmail(payload.email) : "";
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!validEmail(email)) return json({ error: "Email tidak valid." }, 400);
  if (displayName.length < 2 || displayName.length > 80) return json({ error: "Nama harus 2–80 karakter." }, 400);
  if (password.length < 10 || password.length > 200) return json({ error: "Kata sandi harus 10–200 karakter." }, 400);

  const id = crypto.randomUUID();
  const salt = randomToken();
  await env.DB.prepare(
    "INSERT INTO profiles (id, email, display_name, role, status, password_salt, password_hash, created_at) VALUES (?, ?, ?, 'admin', 'active', ?, ?, ?)",
  ).bind(id, email, displayName, salt, await derivePassword(password, salt), now()).run();
  return json({ message: "Admin berhasil dibuat. Silakan login melalui halaman admin." }, 201);
};

const handleLogin = async (request, env) => {
  if (request.method !== "POST") return json({ error: "Metode tidak diizinkan." }, 405);
  const payload = await readJson(request);
  if (!payload) return json({ error: "Body harus berupa JSON yang valid." }, 400);
  const email = typeof payload.email === "string" ? cleanEmail(payload.email) : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!validEmail(email) || password.length > 200) return json({ error: "Email atau kata sandi salah." }, 401);

  const profile = await env.DB.prepare(
    "SELECT id, email, display_name, role, status, password_salt, password_hash FROM profiles WHERE email = ?",
  ).bind(email).first();
  const candidate = profile?.password_salt ? await derivePassword(password, profile.password_salt) : "";
  if (!profile || profile.status !== "active" || !secureEqual(candidate, profile.password_hash || "")) {
    return json({ error: "Email atau kata sandi salah." }, 401);
  }

  const sessionCookie = await createSession(request, env, profile.id);
  return json(
    { user: { id: profile.id, email: profile.email, display_name: profile.display_name, role: profile.role, status: profile.status } },
    200,
    { "Set-Cookie": sessionCookie },
  );
};

const handleInvitation = async (request, env, user) => {
  if (request.method !== "POST") return json({ error: "Metode tidak diizinkan." }, 405);
  if (user.role !== "admin") return json({ error: "Akses admin diperlukan." }, 403);
  const payload = await readJson(request);
  if (!payload) return json({ error: "Body harus berupa JSON yang valid." }, 400);
  const email = typeof payload.email === "string" ? cleanEmail(payload.email) : "";
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  if (!validEmail(email)) return json({ error: "Masukkan alamat email yang valid." }, 400);
  if (displayName.length < 2 || displayName.length > 80) return json({ error: "Nama harus 2–80 karakter." }, 400);

  const existingProfile = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(email).first();
  if (existingProfile) return json({ error: "Email ini sudah memiliki akun." }, 409);

  const existingInvitation = await env.DB.prepare(
    "SELECT expires_at FROM invitations WHERE email = ?",
  ).bind(email).first();
  if (existingInvitation?.expires_at > now()) {
    return json({ error: "Undangan untuk email ini masih aktif." }, 409);
  }
  if (existingInvitation) {
    await env.DB.prepare("DELETE FROM invitations WHERE email = ?").bind(email).run();
  }

  const token = randomToken();
  await env.DB.prepare(
    "INSERT INTO invitations (token_hash, email, display_name, created_by, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(await digest(token), email, displayName, user.id, expiresIn(INVITATION_HOURS * 60 * 60 * 1000)).run();

  const invitationUrl = new URL("/member.html", request.url);
  invitationUrl.searchParams.set("invite", token);
  return json({ message: `Undangan untuk ${email} berhasil dibuat.`, invitationUrl: invitationUrl.toString() }, 201);
};

const handleAcceptInvitation = async (request, env) => {
  if (request.method !== "POST") return json({ error: "Metode tidak diizinkan." }, 405);
  const payload = await readJson(request);
  if (!payload) return json({ error: "Body harus berupa JSON yang valid." }, 400);
  const token = typeof payload.token === "string" ? payload.token : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (password.length < 10 || password.length > 200) return json({ error: "Kata sandi harus 10–200 karakter." }, 400);

  const invitation = await env.DB.prepare(
    "SELECT token_hash, email, display_name FROM invitations WHERE token_hash = ? AND expires_at > ?",
  ).bind(await digest(token), now()).first();
  if (!invitation) return json({ error: "Tautan undangan tidak valid atau sudah kedaluwarsa." }, 400);

  const id = crypto.randomUUID();
  const salt = randomToken();
  const passwordHash = await derivePassword(password, salt);
  const result = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO profiles (id, email, display_name, role, status, password_salt, password_hash, created_at) VALUES (?, ?, ?, 'member', 'active', ?, ?, ?)",
    ).bind(id, invitation.email, invitation.display_name, salt, passwordHash, now()),
    env.DB.prepare("DELETE FROM invitations WHERE token_hash = ?").bind(invitation.token_hash),
  ]);
  if (!result[0].success) return json({ error: "Akun member tidak dapat dibuat." }, 409);

  const sessionCookie = await createSession(request, env, id);
  return json({ message: "Akun aktif. Selamat datang!", user: { id, email: invitation.email, display_name: invitation.display_name, role: "member", status: "active" } }, 201, {
    "Set-Cookie": sessionCookie,
  });
};

const handleWritings = async (request, env, url) => {
  if (request.method === "GET") {
    const view = url.searchParams.get("view") || "published";
    if (view === "published") {
      const { results } = await env.DB.prepare(
        "SELECT id, title, body, author_name, created_at, published_at FROM writings WHERE status = 'published' ORDER BY published_at DESC LIMIT 100",
      ).all();
      return json({ data: results });
    }

    const auth = await requireUser(request, env);
    if (auth.response) return auth.response;
    if (view === "mine") {
      const { results } = await env.DB.prepare(
        "SELECT id, title, status, created_at FROM writings WHERE author_id = ? ORDER BY created_at DESC",
      ).bind(auth.user.id).all();
      return json({ data: results });
    }
    if (view === "pending" && auth.user.role === "admin") {
      const { results } = await env.DB.prepare(
        "SELECT id, title, body, author_name, created_at FROM writings WHERE status = 'pending' ORDER BY created_at ASC",
      ).all();
      return json({ data: results });
    }
    return json({ error: "Akses tidak diizinkan." }, 403);
  }

  if (request.method === "POST") {
    const auth = await requireUser(request, env);
    if (auth.response) return auth.response;
    if (auth.user.role !== "member") return json({ error: "Hanya member yang dapat mengirim tulisan." }, 403);
    const payload = await readJson(request);
    if (!payload) return json({ error: "Body harus berupa JSON yang valid." }, 400);
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (title.length < 3 || title.length > 120) return json({ error: "Judul harus 3–120 karakter." }, 400);
    if (body.length < 20 || body.length > 12000) return json({ error: "Isi tulisan harus 20–12000 karakter." }, 400);

    const createdAt = now();
    const result = await env.DB.prepare(
      "INSERT INTO writings (author_id, author_name, title, body, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    ).bind(auth.user.id, auth.user.display_name, title, body, createdAt).run();
    return json({ data: { id: result.meta.last_row_id } }, 201);
  }

  return json({ error: "Metode tidak diizinkan." }, 405);
};

const handleWritingStatus = async (request, env, writingId) => {
  if (request.method !== "PATCH") return json({ error: "Metode tidak diizinkan." }, 405);
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const payload = await readJson(request);
  if (!payload || !["published", "rejected"].includes(payload.status)) {
    return json({ error: "Status tulisan tidak valid." }, 400);
  }

  const result = await env.DB.prepare(
    "UPDATE writings SET status = ?, published_at = ? WHERE id = ? AND status = 'pending'",
  ).bind(payload.status, payload.status === "published" ? now() : null, writingId).run();
  if (!result.meta.changes) return json({ error: "Tulisan tidak ditemukan atau sudah ditinjau." }, 404);
  return json({ message: "Status tulisan berhasil diperbarui." });
};

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return json({ error: "Tidak ditemukan." }, 404);
  if (request.method !== "GET" && !requireSameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);

  try {
    if (url.pathname === "/api/setup") return await handleSetup(request, env);
    if (url.pathname === "/api/login") return await handleLogin(request, env);
    if (url.pathname === "/api/invitations") {
      const auth = await requireAdmin(request, env);
      return auth.response || await handleInvitation(request, env, auth.user);
    }
    if (url.pathname === "/api/invitations/accept") return await handleAcceptInvitation(request, env);
    if (url.pathname === "/api/session") {
      if (request.method === "DELETE") {
        const token = readCookie(request, SESSION_COOKIE);
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
        return json({ message: "Logout berhasil." }, 200, { "Set-Cookie": clearCookie(request) });
      }
      if (request.method !== "GET") return json({ error: "Metode tidak diizinkan." }, 405);
      const user = await getSession(request, env);
      return json({ user });
    }
    if (url.pathname === "/api/writings") {
      return await handleWritings(request, env, url);
    }
    const writingMatch = url.pathname.match(/^\/api\/writings\/(\d+)$/);
    if (writingMatch) return await handleWritingStatus(request, env, writingMatch[1]);
    return json({ error: "Tidak ditemukan." }, 404);
  } catch (error) {
    console.error("Portfolio API error:", error);
    return json({ error: "Terjadi kesalahan server. Silakan coba lagi." }, 500);
  }
}
