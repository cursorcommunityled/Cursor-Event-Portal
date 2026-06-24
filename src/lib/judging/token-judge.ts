import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Resolve (get-or-create) a distinct judge `users` row for a per-browser judge
// token. This lets several people score the Final Round from the admin URL
// without logging in — each browser carries its own token cookie, so their
// scorecards stay separate and standings can average across them.
//
// The synthetic user has no registration and role "attendee" (least privilege —
// it must never grant admin access, since nobody signs in as it).
export async function resolveTokenJudgeId(
  supabase: ServiceClient,
  eventId: string,
  token: string,
  name?: string | null
): Promise<string | null> {
  const safeToken = token.replace(/[^a-zA-Z0-9-]/g, "");
  if (!safeToken) return null;

  const email = `judge+${eventId}.${safeToken}@cursorpopup.local`;
  const trimmedName = name?.trim() || null;

  const { data: existing } = await supabase
    .from("users")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();

  if (existing?.id) {
    if (trimmedName && trimmedName !== existing.name) {
      await supabase.from("users").update({ name: trimmedName }).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data: created } = await supabase
    .from("users")
    .insert({ name: trimmedName || "Guest Judge", email, role: "attendee" })
    .select("id")
    .single();

  return (created?.id as string | undefined) ?? null;
}
