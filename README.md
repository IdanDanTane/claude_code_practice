# Logistics & Warehouse Executive Dashboard

An Apple-style executive dashboard for the COO and CEO of a phone accessories brand (chargers, cables, earphones/TWS, power banks, creator gear, mounts, cases). It covers SLA compliance, orders at risk of delay or cancellation, inventory health, and cost and carrier performance across a multi-region warehouse network, all on one 16:9 screen on desktop.

**Live:** https://idandantane.github.io/claude_code_practice/

- Product spec: [spec.md](spec.md)
- Working rules and change log: [practice.md](practice.md)
- Airtable import (CSV files, steps, data dictionary): [data/airtable/README.md](data/airtable/README.md)

Features: KPI tiles with drill-down, filters (shareable via URL), light/dark toggle, and one-click **Export PDF** for board packs and email.

Runs entirely in the browser on deterministic mock data. To run it locally, serve the folder with any static server (for example `npx serve .`) and open the printed URL. ES modules don't load over `file://`.
