#!/usr/bin/env node
/**
 * Render cron entrypoint: hit the spare referral sweep API.
 * Requires PORTAL_URL and CRON_SECRET.
 */
const portalUrl = (process.env.PORTAL_URL || "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!portalUrl || !secret) {
  console.error("PORTAL_URL and CRON_SECRET are required");
  process.exit(1);
}

const url = `${portalUrl}/api/cron/sweep-spare-referral-codes`;

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
console.log(text);

if (!res.ok) process.exit(1);
