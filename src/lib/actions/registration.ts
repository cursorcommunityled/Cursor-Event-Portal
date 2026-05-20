"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RegistrationFormData } from "@/types";
import { revalidatePath } from "next/cache";
import {
  parsePortalSession,
  PORTAL_SESSION_COOKIE_NAME,
  serializePortalSession,
} from "@/lib/auth/portal-session";

export async function registerForEvent(
  eventId: string,
  eventSlug: string,
  formData: RegistrationFormData
) {
  const supabase = await createServiceClient();

  // Create or get user
  let userId: string;

  if (formData.email) {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", formData.email)
      .single();

    if (existingUser) {
      userId = existingUser.id;
      // Update name if provided
      await supabase
        .from("users")
        .update({ name: formData.name })
        .eq("id", userId);
    } else {
      // Create new user
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: formData.name,
          email: formData.email,
          role: "attendee",
        })
        .select("id")
        .single();

      if (userError || !newUser) {
        return { error: "Failed to create user" };
      }
      userId = newUser.id;
    }
  } else {
    // Create anonymous user (no email)
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        name: formData.name,
        role: "attendee",
      })
      .select("id")
      .single();

    if (userError || !newUser) {
      return { error: "Failed to create user" };
    }
    userId = newUser.id;
  }

  // Check if already registered
  const { data: existingReg } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  if (existingReg) {
    // Already registered, set session and redirect
    await setSession(userId, eventId);
    return { success: true, alreadyRegistered: true };
  }

  // Check capacity before allowing registration
  const { data: event } = await supabase
    .from("events")
    .select("capacity")
    .eq("id", eventId)
    .single();

  if (event) {
    const { count: registeredCount } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (registeredCount !== null && registeredCount >= event.capacity) {
      return { error: `Event is at full capacity (${event.capacity} attendees). Registration is closed.` };
    }
  }

  // Create registration
  const { error: regError } = await supabase.from("registrations").insert({
    event_id: eventId,
    user_id: userId,
    consent_at: formData.consent ? new Date().toISOString() : null,
    source: "qr",
  });

  if (regError) {
    return { error: "Failed to register" };
  }

  // Set session cookie
  await setSession(userId, eventId);

  return { success: true };
}

async function setSession(userId: string, eventId: string) {
  const cookieStore = await cookies();

  const sessionData = {
    userId,
    eventId,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  cookieStore.set(PORTAL_SESSION_COOKIE_NAME, serializePortalSession(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/", // Ensure cookie is accessible from all routes
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PORTAL_SESSION_COOKIE_NAME);

  return parsePortalSession(session?.value);
}

export async function checkIn(registrationId: string, eventSlug?: string) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("registrations")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", registrationId);

  if (error) {
    return { error: "Failed to check in" };
  }

  // Revalidate groups page to sync checked-in attendees
  if (eventSlug) {
    revalidatePath(`/admin/${eventSlug}/groups`);
  }

  return { success: true };
}

export async function undoCheckIn(registrationId: string, eventSlug?: string) {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("registrations")
    .update({ checked_in_at: null })
    .eq("id", registrationId)
    .select("user_id, event_id");

  if (error) {
    console.error("Undo check-in error:", error);
    return { error: error.message || "Failed to undo check-in" };
  }

  const registration = data?.[0];
  if (registration) {
    await cleanupAttendeeData(supabase, registration.event_id, registration.user_id);
  }

  // Revalidate pages if eventSlug is provided
  if (eventSlug) {
    revalidatePath(`/staff/${eventSlug}/checkin`);
    revalidatePath(`/admin/${eventSlug}/groups`);
  }

  console.log("Successfully undid check-in for registration:", registrationId);
  return { success: true };
}

export async function deregister(registrationId: string, eventSlug?: string) {
  const supabase = await createServiceClient();

  // Get the registration first to find the user_id
  const { data: registration, error: fetchError } = await supabase
    .from("registrations")
    .select("user_id, event_id")
    .eq("id", registrationId)
    .single();

  if (fetchError || !registration) {
    console.error("Deregister fetch error:", fetchError);
    return { error: "Registration not found" };
  }

  // Delete the registration
  const { error: deleteError } = await supabase
    .from("registrations")
    .delete()
    .eq("id", registrationId);

  if (deleteError) {
    console.error("Deregister delete error:", deleteError);
    return { error: deleteError.message || "Failed to deregister" };
  }

  await cleanupAttendeeData(supabase, registration.event_id, registration.user_id);

  // Check if user has any other registrations
  const { data: otherRegs, error: otherRegsError } = await supabase
    .from("registrations")
    .select("id")
    .eq("user_id", registration.user_id)
    .limit(1);

  // If user has no other registrations and is not an admin, optionally delete them
  // For now, we'll keep the user record but remove the registration

  // Revalidate pages if eventSlug is provided
  if (eventSlug) {
    revalidatePath(`/staff/${eventSlug}/checkin`);
    revalidatePath(`/admin/${eventSlug}/groups`);
  }

  console.log("Successfully deregistered registration:", registrationId);
  return { success: true };
}

async function cleanupAttendeeData(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  userId: string
) {
  await supabase
    .from("attendee_intakes")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  const { data: groupIds } = await supabase
    .from("suggested_groups")
    .select("id")
    .eq("event_id", eventId);

  const ids = (groupIds || []).map((group) => group.id);
  if (ids.length > 0) {
    await supabase
      .from("suggested_group_members")
      .delete()
      .eq("user_id", userId)
      .in("group_id", ids);

    const { data: remainingMembers } = await supabase
      .from("suggested_group_members")
      .select("group_id")
      .in("group_id", ids);

    const remainingGroupIds = new Set((remainingMembers || []).map((m) => m.group_id));
    const emptyGroupIds = ids.filter((id) => !remainingGroupIds.has(id));

    if (emptyGroupIds.length > 0) {
      await supabase.from("suggested_groups").delete().in("id", emptyGroupIds);
    }
  }
}

export async function addRegistrationByEmail(
  eventId: string,
  eventSlug: string,
  email: string
) {
  const supabase = await createServiceClient();

  // Check for portal session first
  const session = await getSession();
  let isAuthorized = false;

  if (session) {
    const { data: staffUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (staffUser && ["staff", "admin"].includes(staffUser.role)) {
      isAuthorized = true;
    }
  }

  // Also check Supabase auth for admin users
  if (!isAuthorized) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabaseAuth = await createClient();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

    if (authUser) {
      const { data: adminUser } = await supabase
        .from("users")
        .select("role")
        .eq("email", authUser.email)
        .single();

      if (adminUser && adminUser.role === "admin") {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return { error: "Not authorized" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: "Please enter a valid email address" };
  }

  let userId: string;
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, name")
    .eq("email", normalizedEmail)
    .single();

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const fallbackName = normalizedEmail.split("@")[0] || "Attendee";
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        name: fallbackName,
        email: normalizedEmail,
        role: "attendee",
      })
      .select("id")
      .single();

    if (userError || !newUser) {
      return { error: "Failed to create user" };
    }
    userId = newUser.id;
  }

  const { data: existingReg } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  if (!existingReg) {
    // Check capacity before allowing registration
    const { data: event } = await supabase
      .from("events")
      .select("capacity")
      .eq("id", eventId)
      .single();

    if (event) {
      const { count: registeredCount } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);

      if (registeredCount !== null && registeredCount >= event.capacity) {
        return { error: `Event is at full capacity (${event.capacity} attendees). Cannot add more registrations.` };
      }
    }

    const { error: regError } = await supabase.from("registrations").insert({
      event_id: eventId,
      user_id: userId,
      source: "walk-in",
    });

    if (regError) {
      return { error: "Failed to add registration" };
    }
  }

  const { data: registration, error: fetchError } = await supabase
    .from("registrations")
    .select("*, user:users(*, intakes:attendee_intakes(*))")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !registration) {
    return { error: "Failed to load new registration" };
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/staff/${eventSlug}/checkin`);

  return { success: true, registration };
}

export async function saveRegistrationList(
  eventId: string,
  eventSlug: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();
  let isAuthorized = false;

  if (adminCode) {
    const { data: event, error } = await supabase
      .from("events")
      .select("id, admin_code")
      .eq("id", eventId)
      .single();

    if (!error && event && event.admin_code === adminCode) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    const session = await getSession();
    if (session) {
      const { data: staffUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .single();

      if (staffUser && ["staff", "admin"].includes(staffUser.role)) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return { error: "Not authorized" };
  }

  const { data: registrations, error: fetchError } = await supabase
    .from("registrations")
    .select("user_id, created_at, checked_in_at, source, user:users(name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return { error: "Failed to fetch registrations" };
  }

  const regs = registrations || [];
  const totalRegistered = regs.length;
  const totalCheckedIn = regs.filter((r) => r.checked_in_at).length;

  const attendees = regs.map((r) => ({
    user_id: r.user_id,
    name: (r.user as { name?: string; email?: string } | null)?.name || "Unknown",
    email: (r.user as { name?: string; email?: string } | null)?.email || null,
    registered_at: r.created_at,
    checked_in_at: r.checked_in_at || null,
    source: r.source,
  }));

  const label = new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const { error: insertError } = await supabase
    .from("registration_list_snapshots")
    .insert({ event_id: eventId, total_registered: totalRegistered, total_checked_in: totalCheckedIn, attendees, label });

  if (insertError) {
    return { error: "Failed to save registration list" };
  }

  return { success: true, totalRegistered, totalCheckedIn };
}

export async function clearEventRegistrations(
  eventId: string,
  eventSlug: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();
  let isAuthorized = false;

  // Check adminCode first
  if (adminCode) {
    const { data: event, error } = await supabase
      .from("events")
      .select("id, admin_code")
      .eq("id", eventId)
      .single();

    if (!error && event && event.admin_code === adminCode) {
      isAuthorized = true;
    }
  }

  // Check portal session
  if (!isAuthorized) {
    const session = await getSession();
    if (session) {
      const { data: staffUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .single();

      if (staffUser && ["staff", "admin"].includes(staffUser.role)) {
        isAuthorized = true;
      }
    }
  }

  // Check Supabase auth for admin users
  if (!isAuthorized) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabaseAuth = await createClient();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

    if (authUser) {
      const { data: adminUser } = await supabase
        .from("users")
        .select("role")
        .eq("email", authUser.email)
        .single();

      if (adminUser && adminUser.role === "admin") {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return { error: "Not authorized" };
  }

  const { data: groupIds } = await supabase
    .from("suggested_groups")
    .select("id")
    .eq("event_id", eventId);

  const groupIdList = (groupIds || []).map((group) => group.id);
  if (groupIdList.length > 0) {
    await supabase
      .from("suggested_group_members")
      .delete()
      .in("group_id", groupIdList);
  }

  await supabase
    .from("suggested_groups")
    .delete()
    .eq("event_id", eventId);

  await supabase
    .from("attendee_intakes")
    .delete()
    .eq("event_id", eventId);

  const { error: deleteError } = await supabase
    .from("registrations")
    .delete()
    .eq("event_id", eventId);

  if (deleteError) {
    return { error: deleteError.message || "Failed to clear registrations" };
  }

  revalidatePath(`/staff/${eventSlug}/checkin`);
  revalidatePath(`/admin/${eventSlug}`);
  if (adminCode) {
    revalidatePath(`/admin/${eventSlug}/${adminCode}/checkin`);
    revalidatePath(`/admin/${eventSlug}/${adminCode}`);
  }

  return { success: true };
}
