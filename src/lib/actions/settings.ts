"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setActiveEventSlug(slug: string): Promise<{ error?: string }> {
  // Admin access is controlled by the secret adminCode in the URL — no session cookie needed.
  const service = await createServiceClient();
  const { error } = await service
    .from("app_settings")
    .upsert({ key: "active_event_slug", value: slug, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}
