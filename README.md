# OnboardTrack v2: Customer Onboarding Tracker

Spot stuck customers before they quit.**🔗 Live demo:** https://onboardtrackingsystem.onrender.com

The free server sleeps when idle, so the first load can take about 30 seconds.
Log in as admin (`admin@demo.com` / `Admin@123`) or as a customer (`ravi@sunrise.demo` / `Welcome@123`).

## The problem
B2B software companies lose customers because onboarding (setup) is tracked in WhatsApp, Excel and Google Docs. Nobody notices when a new customer gets stuck, so the customer churns.

## The solution
A full-stack web app with two roles:
- **Customer:** logs in and sees only their own setup checklist and progress bar.
- **Admin (the software company):** sees every customer, a **stuck-customer risk score**, search and filters, and can log reminders and create customer accounts.

## Risk rules (calculated on the server from real timestamps)
| Status | Rule |
|---|---|
| High risk | 5+ days inactive with 2+ steps left, or 7+ days inactive |
| Watch | 3+ days inactive, or 2+ days inactive with 4+ steps left |
| On track | Recently active |
| Completed | All 5 steps done |

## Security (what v1 was missing)
- Login with **scrypt-hashed passwords** (never stored in plain text)
- **HttpOnly, SameSite=Strict session cookie**, 8-hour expiry
- **Role checks on the server for every route**: a customer calling an admin API gets `403`
- Customers can only read or change **their own** record, which is looked up from the session and never from the URL
- Login **rate limiting** (5 attempts per minute) and same-timing responses for unknown emails
- CSRF guard (custom header required on all writes), strict **Content-Security-Policy**, input validation, request size limit, path-traversal protection

## Run it
Requires Node.js 18+. No `npm install` needed (zero dependencies).

```bash
node server.js
```
Open http://localhost:3000

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | Admin@123 |
| Customer | ravi@sunrise.demo | Welcome@123 |

Demo data is created on first run in `data.json`. Delete that file to reset.

## API
| Method | Route | Who |
|---|---|---|
| POST | /api/login, /api/logout | anyone / logged in |
| GET | /api/me | logged in |
| GET | /api/my | customer |
| POST | /api/my/steps/:i | customer (own record only) |
| GET, POST | /api/customers | admin |
| POST | /api/customers/:id/remind | admin |

## Deploy
GitHub Pages cannot run Node.js. Deploy this to a Node host (for example Render or Railway): no build command, start command `node server.js`, and set `NODE_ENV=production`.

## Known limitations
- Data is stored in a JSON file. For production, move to PostgreSQL or SQLite.
- Sessions are in memory, so users must log in again after a server restart.
- "Remind" logs the reminder; it does not send a real email yet.
- Change the demo passwords before any real use.

## Roadmap
- [ ] Real email reminders
- [ ] PostgreSQL
- [ ] Custom onboarding steps per company
- [ ] Password reset

## License
MIT. © 2026 Kotla Abdul Azees.
