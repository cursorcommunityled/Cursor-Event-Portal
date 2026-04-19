"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { sendMagicLink } from "@/lib/email/resend";
import { cookies, headers } from "next/headers";
import { generatePasscode } from "@/lib/utils";
import { rateLimit } from "@/lib/auth/rate-limit";
import crypto from "crypto";

async function getActionIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function requestMagicLink(email: string, eventId: string, eventName: string) {
  // Throttle by IP and by email to prevent spamming users / Resend quota.
  const ip = await getActionIp();
  const ipLimit = rateLimit(`magic-link:ip:${ip}`, { limit: 10, windowMs: 60_000 });
  const emailLimit = rateLimit(`magic-link:email:${email.toLowerCase()}`, {
    limit: 3,
    windowMs: 5 * 60_000,
  });
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: "Too many requests. Please wait a few minutes and try again." };
  }

  const supabase = await createServiceClient();

  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Get or create user
  let userId: string;
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ email, name: email.split("@")[0], role: "attendee" })
      .select("id")
      .single();

    if (error || !newUser) {
      return { error: "Failed to create user" };
    }
    userId = newUser.id;
  }

  // Store magic link token
  const { error: tokenError } = await supabase.from("magic_links").insert({
    token,
    user_id: userId,
    event_id: eventId,
    expires_at: expiresAt.toISOString(),
  });

  if (tokenError) {
    // Table might not exist yet, create simpler flow
    console.error("Magic link storage error:", tokenError);
  }

  // Send email
  const result = await sendMagicLink(email, token, eventName);

  if (result.error) {
    return { error: result.error };
  }

  return { success: true };
}

export async function verifyMagicLink(token: string) {
  const supabase = await createServiceClient();

  const { data: magicLink } = await supabase
    .from("magic_links")
    .select("*, user:users(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .is("used_at", null)
    .single();

  if (!magicLink) {
    return { error: "Invalid or expired link" };
  }

  // Mark as used
  await supabase
    .from("magic_links")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  // Set session
  const cookieStore = await cookies();
  const sessionData = {
    userId: magicLink.user_id,
    eventId: magicLink.event_id,
    role: magicLink.user?.role || "attendee",
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };

  cookieStore.set("portal_session", JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
  });

  return { success: true, eventId: magicLink.event_id };
}

export async function loginWithPasscode(passcode: string, eventId: string) {
  const supabase = await createServiceClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, user:users(*)")
    .eq("passcode", passcode.toUpperCase())
    .eq("event_id", eventId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return { error: "Invalid passcode" };
  }

  // Set session cookie
  const cookieStore = await cookies();
  const sessionData = {
    userId: session.user_id,
    eventId: session.event_id,
    role: session.user?.role || "attendee",
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };

  cookieStore.set("portal_session", JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
  });

  return { success: true };
}

export async function createPasscodeSession(userId: string, eventId: string) {
  const supabase = await createServiceClient();
  const passcode = generatePasscode();

  const { error } = await supabase.from("sessions").insert({
    user_id: userId,
    event_id: eventId,
    passcode,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    return { error: "Failed to create session" };
  }

  return { success: true, passcode };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("portal_session");
  return { success: true };
}

export async function adminLogout() {
  const supabase = await createServiceClient();
  await supabase.auth.signOut();

  // Also clear the session cookie
  const cookieStore = await cookies();
  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");

  return { success: true };
}
