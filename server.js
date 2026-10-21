"use strict";
// OnboardTrack v2: dependency-free Node.js server (Node 18+).
// Auth (scrypt hashed passwords, HttpOnly session cookie), role checks on EVERY route.
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json"), PUB = path.join(__dirname, "public");
const DAY = 864e5, STEPS = ["Create your account", "Import your data", "Invite your team", "Configure settings", "Complete your first task"];
const sessions = new Map(), attempts = new Map();
let db;

// ---------- storage ----------
function save() { const t = DB_FILE + ".tmp"; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, DB_FILE); }
function hash(pw) { const s = crypto.randomBytes(16).toString("hex"); return s + ":" + crypto.scryptSync(pw, s, 64).toString("hex"); }
function verify(pw, stored) {
  const [s, h] = stored.split(":"), a = Buffer.from(h, "hex"), b = crypto.scryptSync(pw, s, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const DUMMY = hash("dummy"); // makes unknown-email logins take the same time as real ones
function addCustomer(company, contact, email, pw, done = [0, 0, 0, 0, 0], idle = 0) {
  const uid = db.nextId++;
  db.users.push({ id: uid, email: email.toLowerCase(), role: "customer", pass: hash(pw) });
  db.customers.push({ id: db.nextId++, userId: uid, company, contact, done, lastActive: Date.now() - idle * DAY, reminded: 0 });
}
function init() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); return; } catch (e) { /* first run */ }
  db = { users: [], customers: [], log: [], nextId: 1 };
  db.users.push({ id: db.nextId++, email: "admin@demo.com", role: "admin", pass: hash("Admin@123") });
  [["Sunrise Public School", "Ravi Kumar", "ravi@sunrise.demo", [1, 1, 0, 0, 0], 6], ["Green Valley Clinic", "Dr. Meena Rao", "meena@greenvalley.demo", [1, 1, 1, 1, 0], 1],
   ["Apex Logistics", "Suresh Babu", "suresh@apex.demo", [1, 0, 0, 0, 0], 8], ["BrightPath Academy", "Anitha S", "anitha@brightpath.demo", [1, 1, 1, 1, 1], 0],
   ["QuickMart Retail", "Imran Khan", "imran@quickmart.demo", [1, 1, 1, 0, 0], 3], ["Nova Web Studio", "Priya Reddy", "priya@nova.demo", [0, 0, 0, 0, 0], 5]]
    .forEach(c => addCustomer(c[0], c[1], c[2], "Welcome@123", c[3], c[4]));
  save();
}

// ---------- helpers ----------
function view(c) {
  const p = c.done.reduce((a, b) => a + b, 0), idle = Math.floor((Date.now() - c.lastActive) / DAY), left = 5 - p;
  const risk = left === 0 ? "done" : ((idle >= 5 && left >= 2) || idle >= 7) ? "high" : (idle >= 3 || (idle >= 2 && left >= 4)) ? "medium" : "low";
  return { id: c.id, company: c.company, contact: c.contact, done: c.done, progress: p, idle, risk, reminded: c.reminded };
}
function addLog(text) { db.log.unshift({ t: Date.now(), text }); db.log = db.log.slice(0, 20); }
const HEAD = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'" };
function send(res, code, obj, extra) { res.writeHead(code, Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, HEAD, extra)); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((ok, no) => { let d = ""; req.on("data", c => { d += c; if (d.length > 10000) { no(new Error("Too large")); req.destroy(); } });
    req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { no(new Error("Bad JSON")); } }); });
}
function getUser(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || ""); if (!m) return null;
  const s = sessions.get(m[1]); if (!s || s.exp < Date.now()) { sessions.delete(m[1]); return null; }
  return { user: db.users.find(u => u.id === s.userId), token: m[1] };
}
function tooMany(ip) { const now = Date.now(), a = (attempts.get(ip) || []).filter(t => now - t < 60000); attempts.set(ip, a); return a.length >= 5; }

// ---------- API ----------
async function api(req, res, p) {
  const m = req.method;
  if (m !== "GET" && req.headers["x-requested-with"] !== "fetch") return send(res, 403, { error: "Forbidden" }); // CSRF guard
  if (p === "/api/login" && m === "POST") {
    const ip = req.socket.remoteAddress; if (tooMany(ip)) return send(res, 429, { error: "Too many attempts. Wait a minute." });
    const b = await body(req), u = db.users.find(x => x.email === String(b.email || "").toLowerCase().trim());
    const ok = verify(String(b.password || ""), u ? u.pass : DUMMY) && u;
    if (!ok) { attempts.get(ip).push(Date.now()); return send(res, 401, { error: "Wrong email or password" }); }
    const t = crypto.randomBytes(32).toString("hex"); sessions.set(t, { userId: u.id, exp: Date.now() + 8 * 36e5 });
    return send(res, 200, { email: u.email, role: u.role }, { "Set-Cookie": `sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` + (process.env.NODE_ENV === "production" ? "; Secure" : "") });
  }
  const auth = getUser(req); if (!auth || !auth.user) return send(res, 401, { error: "Please log in" });
  const u = auth.user;
  if (p === "/api/logout" && m === "POST") { sessions.delete(auth.token); return send(res, 200, { ok: true }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0" }); }
  if (p === "/api/me" && m === "GET") return send(res, 200, { email: u.email, role: u.role });

  if (p.startsWith("/api/my")) { // customer-only: can only ever touch their OWN record (looked up from the session, never from the URL)
    if (u.role !== "customer") return send(res, 403, { error: "Customers only" });
    const c = db.customers.find(x => x.userId === u.id);
    if (p === "/api/my" && m === "GET") return send(res, 200, Object.assign(view(c), { steps: STEPS }));
    const s = /^\/api\/my\/steps\/(\d)$/.exec(p);
    if (s && m === "POST" && +s[1] < 5) { const i = +s[1]; c.done[i] = c.done[i] ? 0 : 1; c.lastActive = Date.now(); if (c.done[i]) addLog(`${c.company} completed: ${STEPS[i]}`); save(); return send(res, 200, Object.assign(view(c), { steps: STEPS })); }
    return send(res, 404, { error: "Not found" });
  }
  if (u.role !== "admin") return send(res, 403, { error: "Admins only" }); // everything below is admin-only
  if (p === "/api/customers" && m === "GET") return send(res, 200, { customers: db.customers.map(view), log: db.log });
  if (p === "/api/customers" && m === "POST") {
    const b = await body(req), company = String(b.company || "").trim().slice(0, 80), contact = String(b.contact || "").trim().slice(0, 80);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 120), pw = String(b.password || "");
    if (!company || !contact) return send(res, 400, { error: "Company and contact are required" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "Enter a valid email" });
    if (pw.length < 8) return send(res, 400, { error: "Password must be at least 8 characters" });
    if (db.users.some(x => x.email === email)) return send(res, 409, { error: "That email already exists" });
    addCustomer(company, contact, email, pw); addLog(`New customer added: ${company}`); save(); return send(res, 201, { ok: true });
  }
  const r = /^\/api\/customers\/(\d+)\/remind$/.exec(p);
  if (r && m === "POST") {
    const c = db.customers.find(x => x.id === +r[1]); if (!c) return send(res, 404, { error: "Not found" });
    c.reminded++; addLog(`Reminder sent to ${c.contact} (${c.company})`); save(); return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: "Not found" });
}

// ---------- static files ----------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
function serve(req, res, p) {
  const f = path.normalize(path.join(PUB, p === "/" ? "index.html" : p));
  if (!f.startsWith(PUB + path.sep) || req.method !== "GET") { res.writeHead(404, HEAD); return res.end("Not found"); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404, HEAD); return res.end("Not found"); }
    res.writeHead(200, Object.assign({ "Content-Type": (MIME[path.extname(f)] || "text/plain") + "; charset=utf-8" }, HEAD)); res.end(d); });
}

init();
http.createServer(async (req, res) => {
  try { const p = new URL(req.url, "http://x").pathname; if (p.startsWith("/api/")) await api(req, res, p); else serve(req, res, p); }
  catch (e) { send(res, e.message === "Bad JSON" || e.message === "Too large" ? 400 : 500, { error: e.message === "Bad JSON" || e.message === "Too large" ? e.message : "Server error" }); }
}).listen(PORT, () => console.log(`OnboardTrack running at http://localhost:${PORT}`));
