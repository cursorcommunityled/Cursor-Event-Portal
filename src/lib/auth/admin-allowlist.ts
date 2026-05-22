const STATIC_ADMIN_EMAILS = new Set([
  "ethan.bayarsaikhan@edu.sait.ca",
  "mayurrajendrakumar.brahmbhatt@edu.sait.ca",
]);

export function isStaticAdminEmail(email: string | null | undefined) {
  return Boolean(email && STATIC_ADMIN_EMAILS.has(email.trim().toLowerCase()));
}
