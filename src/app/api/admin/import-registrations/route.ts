import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import {
  parsePortalSession,
  PORTAL_SESSION_COOKIE_NAME,
} from "@/lib/auth/portal-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, attendees, markCheckedIn } = body;
    // When true, this is the on-site "who actually showed up" list: mark each row
    // checked in (which is what gates Cursor credits). When false/omitted, rows are
    // registered only — they get portal access but no credits.
    const shouldCheckIn = markCheckedIn === true;

    if (!eventId || !attendees || !Array.isArray(attendees)) {
      return NextResponse.json(
        { error: "Missing eventId or attendees" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check for admin code in header (alternative to session auth)
    const adminCode = request.headers.get("x-admin-code");
    const headerEventId = request.headers.get("x-event-id");

    if (adminCode && headerEventId) {
      // Validate admin code against event
      const { data: event } = await supabase
        .from("events")
        .select("admin_code")
        .eq("id", headerEventId)
        .single();

      if (!event || event.admin_code !== adminCode) {
        return NextResponse.json({ error: "Invalid admin code" }, { status: 403 });
      }
      // Admin code is valid, proceed
    } else {
      // Fall back to session auth
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(PORTAL_SESSION_COOKIE_NAME);
      const session = parsePortalSession(sessionCookie?.value);
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      // Verify admin role
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.userId)
        .single();

      if (!user || user.role !== "admin") {
        // Log details server-side; never echo userIds/roles to the client.
        console.error("[import-registrations] Admin check failed", {
          hasUser: !!user,
          userError: userError?.message,
        });
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
    }

    // Verify event exists
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let imported = 0;
    let skipped = 0;
    let checkedIn = 0;
    let profilesUpdated = 0;
    const errors: string[] = [];
    const nowIso = new Date().toISOString();

    const saveHackathonProfile = async (
      userId: string,
      attendee: {
        email: string;
        occupation?: string;
        is_technical?: boolean;
        unique_skill?: string;
        linkedin_url?: string;
        needs_team?: boolean;
        accessibility?: string;
        profile_bio?: string;
        project_interests?: string;
        collaboration_style?: string;
        looking_for_teammates?: string;
      }
    ) => {
      const hasSurveyData =
        attendee.occupation ||
        attendee.is_technical !== undefined ||
        attendee.unique_skill ||
        attendee.linkedin_url ||
        attendee.needs_team !== undefined ||
        attendee.accessibility ||
        attendee.profile_bio ||
        attendee.project_interests ||
        attendee.collaboration_style ||
        attendee.looking_for_teammates;

      if (!hasSurveyData) return;

      const payload: Record<string, unknown> = {
        user_id: userId,
        event_id: eventId,
        updated_at: new Date().toISOString(),
      };

      if (attendee.occupation !== undefined) payload.occupation = attendee.occupation || null;
      if (attendee.is_technical !== undefined) payload.is_technical = attendee.is_technical;
      if (attendee.unique_skill !== undefined) payload.unique_skill = attendee.unique_skill || null;
      if (attendee.linkedin_url !== undefined) payload.linkedin_url = attendee.linkedin_url || null;
      if (attendee.needs_team !== undefined) payload.needs_team = attendee.needs_team;
      if (attendee.accessibility !== undefined) payload.accessibility = attendee.accessibility || null;
      if (attendee.profile_bio !== undefined) payload.profile_bio = attendee.profile_bio || null;
      if (attendee.project_interests !== undefined) payload.project_interests = attendee.project_interests || null;
      if (attendee.collaboration_style !== undefined) payload.collaboration_style = attendee.collaboration_style || null;
      if (attendee.looking_for_teammates !== undefined) payload.looking_for_teammates = attendee.looking_for_teammates || null;

      const { error } = await supabase.from("hackathon_profiles").upsert(
        payload,
        { onConflict: "user_id,event_id" }
      );

      if (error) {
        errors.push(`Failed to save profile for ${attendee.email}: ${error.message}`);
      } else {
        profilesUpdated++;
      }
    };

    for (const attendee of attendees) {
      const {
        name,
        email,
        occupation,
        is_technical,
        unique_skill,
        linkedin_url,
        needs_team,
        accessibility,
        profile_bio,
        project_interests,
        collaboration_style,
        looking_for_teammates,
      } = attendee as {
        name: string;
        email: string;
        occupation?: string;
        is_technical?: boolean;
        unique_skill?: string;
        linkedin_url?: string;
        needs_team?: boolean;
        accessibility?: string;
        profile_bio?: string;
        project_interests?: string;
        collaboration_style?: string;
        looking_for_teammates?: string;
      };

      if (!name || !email) {
        errors.push(`Invalid attendee data: ${JSON.stringify(attendee)}`);
        continue;
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .single();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user
        const { data: newUser, error: userError } = await supabase
          .from("users")
          .insert({
            name: name.trim(),
            email: normalizedEmail,
            role: "attendee",
          })
          .select("id")
          .single();

        if (userError || !newUser) {
          errors.push(`Failed to create user for ${email}: ${userError?.message}`);
          continue;
        }

        userId = newUser.id;
      }

      await saveHackathonProfile(userId, {
        email: normalizedEmail,
        occupation,
        is_technical,
        unique_skill,
        linkedin_url,
        needs_team,
        accessibility,
        profile_bio,
        project_interests,
        collaboration_style,
        looking_for_teammates,
      });

      // Check if registration already exists
      const { data: existingReg } = await supabase
        .from("registrations")
        .select("id, checked_in_at")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .single();

      if (existingReg) {
        // On the on-site list, flip already-registered people to checked in so they
        // qualify for credits. Otherwise this is a no-op (they're already registered).
        if (shouldCheckIn && !existingReg.checked_in_at) {
          const { error: checkInError } = await supabase
            .from("registrations")
            .update({ checked_in_at: nowIso })
            .eq("id", existingReg.id);
          if (checkInError) {
            errors.push(`Failed to check in ${email}: ${checkInError.message}`);
            continue;
          }
          checkedIn++;
        } else {
          skipped++;
        }
        continue;
      }

      // Create registration
      const { error: regError } = await supabase.from("registrations").insert({
        event_id: eventId,
        user_id: userId,
        source: "link", // Using 'link' as source type (valid: qr, link, walk-in)
        checked_in_at: shouldCheckIn ? nowIso : null,
      });

      if (regError) {
        errors.push(`Failed to register ${email}: ${regError.message}`);
        continue;
      }

      imported++;
      if (shouldCheckIn) checkedIn++;
    }

    return NextResponse.json({
      imported,
      skipped,
      checkedIn,
      profilesUpdated,
      errors: errors.slice(0, 10), // Limit errors returned
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

