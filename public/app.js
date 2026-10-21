"use strict";
var app = document.getElementById("app"), me = null, filter = "all", q = "", customers = [];
var LABEL = { done: "Completed", high: "High risk", medium: "Watch", low: "On track" };
var COL = { high: "var(--red)", medium: "var(--amber)", low: "var(--blue)", done: "var(--green)" };
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.className = "show"; clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = ""; }, 2400); }
async function api(path, method, data) {
  var r = await fetch("/api" + path, { method: method || "GET", headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" }, body: data ? JSON.stringify(data) : undefined });
  var d = await r.json().catch(function () { return {}; });
  if (!r.ok) { var e = new Error(d.error || "Request failed"); e.status = r.status; throw e; }
  return d;
}
function loginView(err) {
  app.innerHTML = '<div class="card login"><h1>📋 OnboardTrack<small>Log in to continue</small></h1><br><form id="lf"><input name="email" type="email" placeholder="Email" required autocomplete="username"><input name="password" type="password" placeholder="Password" required autocomplete="current-password"><p class="err">' + esc(err || "") + '</p><button class="btn pri">Log in</button></form><p class="muted" style="font-size:13px">Demo admin: admin@demo.com / Admin@123<br>Demo customer: ravi@sunrise.demo / Welcome@123</p></div>';
}
async function render() {
  if (!me) return loginView();
  app.innerHTML = '<header><h1>📋 OnboardTrack<small>' + (me.role === "admin" ? "Company dashboard" : "Customer portal") + '</small></h1><div class="tools"><span class="role">' + me.role + '</span><span class="muted">' + esc(me.email) + '</span><button class="btn" data-a="logout">Log out</button></div></header><div id="main"></div>';
  try { if (me.role === "admin") await adminLoad(); else await portalLoad(); }
  catch (e) { if (e.status === 401) { me = null; loginView("Session expired. Please log in again."); } else toast(e.message); }
}
// ----- admin -----
async function adminLoad() {
  var d = await api("/customers"); customers = d.customers;
  var cnt = { high: 0, medium: 0, low: 0, done: 0 }; customers.forEach(function (c) { cnt[c.risk]++; });
  var avg = customers.length ? Math.round(customers.reduce(function (a, c) { return a + c.progress; }, 0) / customers.length / 5 * 100) : 0;
  var h = '<div class="stats"><div class="stat"><b>' + customers.length + '</b><span>Total customers</span></div><div class="stat"><b style="color:var(--red)">' + cnt.high + '</b><span>High risk</span></div><div class="stat"><b>' + avg + '%</b><span>Average progress</span></div><div class="stat"><b style="color:var(--green)">' + cnt.done + '</b><span>Fully onboarded</span></div></div>';
  h += '<div class="card"><h2>Customer health</h2><div class="bar">';
  ["high", "medium", "low", "done"].forEach(function (k) { if (customers.length) h += '<i style="width:' + cnt[k] / customers.length * 100 + '%;background:' + COL[k] + '"></i>'; });
  h += '</div><div class="legend">';
  ["high", "medium", "low", "done"].forEach(function (k) { h += '<span><span class="dot" style="background:' + COL[k] + '"></span>' + LABEL[k] + ' (' + cnt[k] + ')</span>'; });
  h += '</div></div><div class="card"><div class="tools"><input id="sq" placeholder="Search company" value="' + esc(q) + '"><select id="sf">';
  [["all", "All customers"], ["high", "High risk"], ["medium", "Watch"], ["low", "On track"], ["done", "Completed"]].forEach(function (o) { h += '<option value="' + o[0] + '"' + (filter === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; });
  h += '</select><button class="btn pri" data-a="toggleadd">+ Add customer</button></div>';
  h += '<form id="af" class="add"><div class="grid2"><input name="company" placeholder="Company name" required><input name="contact" placeholder="Contact person" required><input name="email" type="email" placeholder="Customer login email" required><input name="password" type="text" placeholder="Temporary password (8+ chars)" minlength="8" required></div><button class="btn pri">Create customer account</button></form>';
  h += '<div class="scroll"><table><tr><th>Customer</th><th>Progress</th><th>Inactive</th><th>Status</th><th></th></tr><tbody id="rows"></tbody></table></div></div><div class="card log"><h2>Recent activity</h2>';
  if (!d.log.length) h += '<div>No activity yet.</div>';
  d.log.slice(0, 8).forEach(function (l) { h += '<div>' + esc(new Date(l.t).toLocaleString()) + ' — ' + esc(l.text) + '</div>'; });
  document.getElementById("main").innerHTML = h + '</div>'; rows();
}
function rows() {
  var o = { high: 0, medium: 1, low: 2, done: 3 };
  var list = customers.filter(function (c) { return (filter === "all" || c.risk === filter) && c.company.toLowerCase().indexOf(q.toLowerCase()) > -1; }).sort(function (a, b) { return o[a.risk] - o[b.risk] || b.idle - a.idle; });
  var h = ""; list.forEach(function (c) {
    var why = c.risk === "done" ? "" : '<small>' + c.idle + ' days idle, ' + (5 - c.progress) + ' steps left</small>';
    h += '<tr><td><b>' + esc(c.company) + '</b><small>' + esc(c.contact) + '</small></td><td><span class="pbar"><i style="width:' + c.progress * 20 + '%"></i></span>' + c.progress + '/5</td><td>' + (c.risk === "done" ? "–" : c.idle + " days") + '</td><td><span class="badge ' + c.risk + '">' + LABEL[c.risk] + '</span>' + why + '</td><td>' + (c.risk === "done" ? "" : '<button class="btn" data-a="remind" data-id="' + c.id + '">Remind' + (c.reminded ? " (" + c.reminded + ")" : "") + '</button>') + '</td></tr>';
  });
  document.getElementById("rows").innerHTML = h || '<tr><td colspan="5" class="muted">No customers in this view.</td></tr>';
}
// ----- customer -----
async function portalLoad() {
  var c = await api("/my"), h = '<div class="card"><h2>Welcome, ' + esc(c.contact) + '! 👋</h2><p class="muted">' + esc(c.company) + ' — finish these steps to get the most out of your new software.</p><div class="bar" style="margin:12px 0 6px"><i style="width:' + c.progress * 20 + '%;background:var(--brand)"></i></div><p class="muted" style="margin:0 0 14px">' + c.progress + ' of 5 steps done</p>';
  c.steps.forEach(function (s, i) { h += '<label class="check' + (c.done[i] ? " ok" : "") + '"><input type="checkbox" data-step="' + i + '"' + (c.done[i] ? " checked" : "") + '><span>' + (i + 1) + '. ' + esc(s) + '</span></label>'; });
  h += c.progress === 5 ? '<p style="color:var(--green);font-weight:600">🎉 All done! You’re fully set up.</p>' : '<p class="muted">Next up: <b>' + esc(c.steps[c.done.indexOf(0)]) + '</b></p>';
  document.getElementById("main").innerHTML = h + '</div>';
}
// ----- events -----
document.addEventListener("submit", async function (e) {
  e.preventDefault(); var f = e.target, d = {}; new FormData(f).forEach(function (v, k) { d[k] = v; });
  try {
    if (f.id === "lf") { me = await api("/login", "POST", d); render(); }
    if (f.id === "af") { await api("/customers", "POST", d); toast("Customer account created"); render(); }
  } catch (err) { if (f.id === "lf") loginView(err.message); else toast(err.message); }
});
document.addEventListener("click", async function (e) {
  var b = e.target.closest("[data-a]"); if (!b) return;
  try {
    if (b.dataset.a === "logout") { await api("/logout", "POST"); me = null; loginView(); }
    if (b.dataset.a === "toggleadd") document.getElementById("af").classList.toggle("show");
    if (b.dataset.a === "remind") { await api("/customers/" + b.dataset.id + "/remind", "POST"); toast("Reminder logged"); render(); }
  } catch (err) { toast(err.message); }
});
document.addEventListener("change", async function (e) {
  if (e.target.id === "sf") { filter = e.target.value; rows(); }
  if (e.target.dataset.step !== undefined) { try { await api("/my/steps/" + e.target.dataset.step, "POST"); portalLoad(); } catch (err) { toast(err.message); } }
});
document.addEventListener("input", function (e) { if (e.target.id === "sq") { q = e.target.value; rows(); } });
(async function () { try { me = await api("/me"); } catch (e) { me = null; } render(); })();
