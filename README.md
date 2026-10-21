# OnboardTrack: Customer Onboarding Tracker

Spot stuck customers before they quit.

## The problem
B2B software companies lose customers because setup (onboarding) is tracked in WhatsApp, Excel and Google Docs. Nobody notices when a new customer gets stuck, so the customer churns.

## The solution
A web app with two views:
- **Customer portal:** a simple checklist with a progress bar.
- **Company dashboard:** all customers in one place, with a rule-based **stuck-customer risk score** (days inactive + steps remaining), search, filters and reminders.

## Risk rules
- **High risk:** 5+ days inactive with 2+ steps left, or 7+ days inactive
- **Watch:** 3+ days inactive, or 2+ days with 4+ steps left
- **On track:** recently active
- **Completed:** all 5 steps done

## Tech
HTML, CSS, vanilla JavaScript. Data is saved in the browser (localStorage).

## Run it
Open `index.html` in a browser. To deploy, push to GitHub and import the repo on Vercel or Netlify.

## Roadmap
- [ ] Node.js + Express REST API with a database
- [ ] Login for company and customer
- [ ] Real email reminders
- [ ] Custom onboarding steps per company


© 2026 Kotla Abdul Azees. All rights reserved.
