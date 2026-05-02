"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "./registration";
import { revalidatePath } from "next/cache";
import { getEventIntakes } from "@/lib/supabase/queries";
import type { GroupStatus, AttendeeIntake } from "@/types";
import OpenAI from "openai";
import { generateHybridGroupMatches } from "@/lib/utils/matching";

// Lazy initialization to avoid build-time errors
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
  });
}

function getAdminGroupsPath(eventSlug: string, adminCode?: string) {
  return adminCode ? `/admin/${eventSlug}/${adminCode}/groups` : `/admin/${eventSlug}/groups`;
}

async function validateAdminAccess(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  adminCode?: string
) {
  if (adminCode) {
    const { data: event } = await supabase
      .from("events")
      .select("admin_code")
      .eq("id", eventId)
      .single();

    if (event && event.admin_code === adminCode) {
      return { valid: true as const };
    }

    return { valid: false as const, error: "Not authorized" };
  }

  const session = await getSession();
  if (!session) {
    return { valid: false as const, error: "Not authenticated" };
  }

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  if (!user || user.role !== "admin") {
    return { valid: false as const, error: "Not authorized" };
  }

  return { valid: true as const };
}

async function generateGroupSuggestions(intakes: AttendeeIntake[]) {
  // Prepare intake summaries for the LLM
  const attendeeSummaries = intakes.map((intake) => ({
    id: intake.user_id,
    name: intake.user?.name || "Anonymous",
    goals: (() => {
      const goals = [...intake.goals, intake.goals_other].filter(Boolean);
      return goals.length > 0 ? goals : ["general networking"];
    })(),
    offers: (() => {
      const offers = [...intake.offers, intake.offers_other].filter(Boolean);
      return offers.length > 0 ? offers : ["open to connect"];
    })(),
    skipped: intake.skipped,
  }));

  // Aim for tables of 5 wherever possible, allow up to 6 when needed
  const targetGroupSize = 5;
  const targetGroupCount = Math.max(1, Math.ceil(attendeeSummaries.length / targetGroupSize));

  const prompt = `You are an expert at creating high-value networking opportunities at tech events. Your goal is to form groups where each person can meet others who can genuinely help them achieve their goals.

CRITICAL MATCHING STRATEGY:
- For each person, identify who in the pool can BEST help them achieve their stated GOALS
- Prioritize matches where Person A's OFFERS directly address Person B's GOALS
- Create groups where there are MULTIPLE mutual benefit connections (not just one-to-one)
- Ensure every person with stated goals has at least one other person whose offers align with their goals
- Maximize the number of "value exchanges" within each group
- Some attendees may have skipped the intake and have generic goals/offers; still assign them to a group based on best-fit and balance

Attendees:
${JSON.stringify(attendeeSummaries, null, 2)}

Your task:
Create ${targetGroupCount} groups. Aim for groups of exactly 5 people wherever possible. Groups can have up to 6 people only when necessary to accommodate all attendees. Where:
1. When goals are provided, each person's GOALS are matched with at least one other person's OFFERS in the same group
2. Groups enable multiple mutual benefit connections (Person A helps Person B, Person B helps Person C, Person C helps Person A, etc.)
3. Each group has a clear theme based on the primary value exchange opportunities
4. Every attendee is placed in exactly one group
5. Groups are balanced - avoid putting all similar people together; create complementary skill/interest diversity
6. Prefer groups of exactly 5 people; only use 6 when needed to fit everyone

For each group, explain:
- The primary theme and why these people benefit from meeting each other
- For each member, specifically which other member(s) can help them and how

IMPORTANT: In matchReasons, use the person's NAME (not their ID) when referring to other members.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "groups": [
    {
      "name": "Group theme name (e.g., 'AI Founders & Technical Talent')",
      "description": "Detailed explanation of why these people are matched together and the mutual benefit opportunities",
      "memberIds": ["user-id-1", "user-id-2", "user-id-3"],
      "matchReasons": {
        "user-id-1": "Can benefit from meeting [Person Name 2] (who offers X which aligns with their goal Y) and [Person Name 3] (who offers Z)",
        "user-id-2": "Can benefit from meeting [Person Name 1] (who offers A which aligns with their goal B)",
        "user-id-3": "Can benefit from meeting [Person Name 1] (who offers C which aligns with their goal D)"
      }
    }
  ]
}

Remember: Use actual names from the attendees list in matchReasons, NOT user IDs.`;

  try {
    console.log("[generateGroupSuggestions] Calling OpenAI API with", attendeeSummaries.length, "attendees");
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert networking facilitator specializing in creating high-value connections at tech events. Your expertise is in identifying complementary skills, goals, and offers to maximize mutual benefit opportunities. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8, // Slightly higher for more creative matching
      max_tokens: 3000, // Increased for more detailed explanations
    });

    console.log("[generateGroupSuggestions] OpenAI API call successful");

    // Extract JSON from response
    const responseText = completion.choices[0]?.message?.content || "";
    console.log("[generateGroupSuggestions] Response length:", responseText.length, "characters");

    // Try to parse as JSON directly first, then try to extract JSON from markdown
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.warn("[generateGroupSuggestions] Direct JSON parse failed, trying to extract JSON from response");
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("[generateGroupSuggestions] Failed to parse LLM response:", responseText.substring(0, 500));
        throw new Error("Failed to parse LLM response as JSON");
      }
      result = JSON.parse(jsonMatch[0]);
    }

    let groups = result.groups || [];
    console.log("[generateGroupSuggestions] Successfully parsed", groups.length, "groups from OpenAI response");
    
    // Create a map of user IDs to names for replacing IDs in matchReasons
    const userIdToName = new Map<string, string>();
    attendeeSummaries.forEach((attendee) => {
      userIdToName.set(attendee.id, attendee.name);
    });
    
    // Process groups to replace any user IDs in matchReasons with names
    groups = groups.map((group: any) => {
      if (group.matchReasons && typeof group.matchReasons === 'object') {
        const processedReasons: Record<string, string> = {};
        Object.keys(group.matchReasons).forEach((userId) => {
          let reason = group.matchReasons[userId];
          // Replace any user IDs in the reason text with names
          userIdToName.forEach((name, id) => {
            // Replace ID references with names
            reason = reason.replace(new RegExp(id, 'g'), name);
          });
          processedReasons[userId] = reason;
        });
        return { ...group, matchReasons: processedReasons };
      }
      return group;
    });
    
    console.log("[generateGroupSuggestions] Processed match reasons to use names instead of IDs");

    // Validate and fix duplicate user assignments
    // Each user should only appear in exactly one group
    const assignedUsers = new Set<string>();
    const duplicatesRemoved: string[] = [];

    groups = groups.map((group: any) => {
      if (!group.memberIds || !Array.isArray(group.memberIds)) {
        return group;
      }

      // Filter out users who are already assigned to a previous group
      const uniqueMembers = group.memberIds.filter((userId: string) => {
        if (assignedUsers.has(userId)) {
          const userName = userIdToName.get(userId) || userId;
          duplicatesRemoved.push(`${userName} (removed from "${group.name}")`);
          return false; // Remove this user from this group
        }
        assignedUsers.add(userId);
        return true;
      });

      // Also clean up matchReasons for removed users
      const cleanedMatchReasons: Record<string, string> = {};
      if (group.matchReasons) {
        uniqueMembers.forEach((userId: string) => {
          if (group.matchReasons[userId]) {
            cleanedMatchReasons[userId] = group.matchReasons[userId];
          }
        });
      }

      return {
        ...group,
        memberIds: uniqueMembers,
        matchReasons: cleanedMatchReasons,
      };
    });

    // Filter out any groups that now have fewer than 2 members
    const validGroups = groups.filter((group: any) =>
      group.memberIds && group.memberIds.length >= 2
    );

    if (duplicatesRemoved.length > 0) {
      console.warn("[generateGroupSuggestions] Removed duplicate user assignments:", duplicatesRemoved);
    }

    if (validGroups.length < groups.length) {
      console.warn("[generateGroupSuggestions] Filtered out", groups.length - validGroups.length, "groups with fewer than 2 members after deduplication");
    }

    console.log("[generateGroupSuggestions] Final group count after deduplication:", validGroups.length);

    return validGroups;
  } catch (error) {
    console.error("[generateGroupSuggestions] OpenAI API error:", error);
    if (error instanceof Error) {
      console.error("[generateGroupSuggestions] Error message:", error.message);
      console.error("[generateGroupSuggestions] Error stack:", error.stack);
    }
    throw error;
  }
}

export async function generateGroups(eventId: string, eventSlug: string, adminCode?: string) {
  console.log("[generateGroups] Starting group generation for event:", eventId);

  // Verify admin role
  let supabase;
  try {
    supabase = await createServiceClient();
  } catch (error) {
    console.error("[generateGroups] Failed to create Supabase client:", error);
    return { error: "Failed to connect to database. Please try again." };
  }

  const auth = await validateAdminAccess(supabase, eventId, adminCode);
  if (!auth.valid) {
    console.log("[generateGroups] Not authorized");
    return { error: auth.error || "Not authorized" };
  }

  // Get all intakes
  let intakes;
  try {
    intakes = await getEventIntakes(eventId);
    console.log("[generateGroups] Found intakes:", intakes.length);
  } catch (error) {
    console.error("[generateGroups] Failed to get intakes:", error);
    return { error: "Failed to load attendee data. Please try again." };
  }

  // Filter out users who are already assigned to approved groups
  const { data: approvedGroupMembers } = await supabase
    .from("suggested_group_members")
    .select(`
      user_id,
      suggested_groups!inner(event_id, status)
    `)
    .eq("suggested_groups.event_id", eventId)
    .eq("suggested_groups.status", "approved");

  const assignedUserIds = new Set(
    (approvedGroupMembers || []).map((m: any) => m.user_id)
  );

  if (assignedUserIds.size > 0) {
    console.log("[generateGroups] Filtering out", assignedUserIds.size, "users already in approved groups");
    intakes = intakes.filter((intake) => !assignedUserIds.has(intake.user_id));
    console.log("[generateGroups] Remaining unassigned intakes:", intakes.length);
  }

  if (intakes.length < 2) {
    return { error: "Need at least 2 unassigned attendees to form groups. All attendees with intake responses are already assigned to approved groups." };
  }

  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("[generateGroups] OPENAI_API_KEY is not set");
    return { error: "OpenAI API key is not configured. Please contact support." };
  }

  // Call hybrid matching system (embeddings + constraints + scoring)
  let groups: Array<{
    name: string;
    description: string;
    memberIds: string[];
    matchReasons?: Record<string, string>;
    score?: number;
    constraints?: any[];
  }>;
  try {
    console.log("[generateGroups] Calling hybrid matching system...");
    console.log("[generateGroups] Number of intakes:", intakes.length);
    console.log("[generateGroups] OpenAI API key present:", !!process.env.OPENAI_API_KEY);
    
    // Set a timeout for the matching call (4 minutes max — reasoning model needs more time)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Group generation timed out after 4 minutes")), 4 * 60 * 1000);
    });
    
    const startTime = Date.now();
    const matchingResult = await Promise.race([
      generateHybridGroupMatches(intakes),
      timeoutPromise
    ]);
    const duration = Date.now() - startTime;
    
    groups = matchingResult.groups;
    console.log("[generateGroups] Generated groups:", groups?.length || 0, `(took ${duration}ms)`);
    console.log("[generateGroups] Average score:", groups.length > 0 ? (groups.reduce((sum, g) => sum + (g.score || 0), 0) / groups.length).toFixed(2) : 0);
  } catch (error) {
    console.error("[generateGroups] Failed to generate groups:", error);
    console.error("[generateGroups] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
    const errorMessage = error instanceof Error ? error.message : "Failed to generate group suggestions";
    
    // Check for specific error types
    if (errorMessage.includes("timed out") || errorMessage.includes("timeout") || errorMessage.includes("aborted")) {
      return { error: "Group generation timed out. This can happen if the AI response takes too long. Please try again or contact support if the issue persists." };
    }
    
    if (errorMessage.includes("API key") || errorMessage.includes("authentication") || errorMessage.includes("401") || errorMessage.includes("403")) {
      return { error: "OpenAI API authentication failed. Please check server configuration." };
    }
    
    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return { error: "OpenAI API rate limit exceeded. Please wait a moment and try again." };
    }
    
    // Return detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV === "development";
    return { 
      error: isDevelopment 
        ? `Failed to generate groups: ${errorMessage}` 
        : "Failed to generate group suggestions. Please try again or contact support if the issue persists."
    };
  }

  if (!groups || !Array.isArray(groups) || groups.length === 0) {
    console.error("[generateGroups] Invalid or empty groups response:", groups);
    return { error: "Invalid response from AI or no groups generated" };
  }

  // Clear existing pending groups for this event
  console.log("[generateGroups] Clearing existing pending groups...");
  const { error: deleteError } = await supabase
    .from("suggested_groups")
    .delete()
    .eq("event_id", eventId)
    .eq("status", "pending");

  if (deleteError) {
    console.error("[generateGroups] Error clearing existing groups:", deleteError);
  }

  // Store suggested groups with sequential table numbers
  let savedCount = 0;
  let tableNumber = 1;
  const errors: string[] = [];
  
  for (const group of groups) {
    try {
      const { data: newGroup, error: groupError } = await supabase
        .from("suggested_groups")
        .insert({
          event_id: eventId,
          name: group.name,
          description: group.description,
          status: "pending",
          table_number: tableNumber,
          match_score: group.score || null,
        })
        .select("id")
        .single();
      
      tableNumber++; // Increment for next group

      if (groupError || !newGroup) {
        console.error("[generateGroups] Error saving group:", groupError, group);
        errors.push(`Failed to save group "${group.name}": ${groupError?.message || "Unknown error"}`);
        continue;
      }

      // Insert group members
      if (group.memberIds && Array.isArray(group.memberIds) && group.memberIds.length > 0) {
        const members = group.memberIds.map((userId: string) => ({
          group_id: newGroup.id,
          user_id: userId,
          match_reason: group.matchReasons?.[userId] || null,
        }));

        const { error: membersError } = await supabase
          .from("suggested_group_members")
          .insert(members);

        if (membersError) {
          console.error("[generateGroups] Error saving group members:", membersError);
          errors.push(`Failed to save members for group "${group.name}": ${membersError.message}`);
        } else {
          savedCount++;
          console.log("[generateGroups] Successfully saved group:", group.name, "with", members.length, "members");
        }
      } else {
        console.warn("[generateGroups] Group has no members:", group.name);
        errors.push(`Group "${group.name}" has no members assigned`);
      }
    } catch (error) {
      console.error("[generateGroups] Exception saving group:", error, group);
      errors.push(`Exception saving group "${group.name}": ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

    console.log("[generateGroups] Saved", savedCount, "out of", groups.length, "groups");
  if (errors.length > 0) {
    console.warn("[generateGroups] Errors encountered:", errors);
  }

  // Revalidate the path to show new groups
  try {
    revalidatePath(getAdminGroupsPath(eventSlug, adminCode));
    console.log("[generateGroups] Path revalidated successfully");
  } catch (error) {
    console.error("[generateGroups] Error revalidating path:", error);
  }

  if (savedCount === 0) {
    const errorMsg = errors.length > 0 
      ? `Failed to save any groups. ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}` 
      : "Failed to save any groups. Please check the server logs for details.";
    console.error("[generateGroups] No groups saved:", errorMsg);
    return { error: errorMsg };
  }

  if (errors.length > 0 && savedCount < groups.length) {
    // Partial success
    const warning = `Saved ${savedCount} of ${groups.length} groups. Some errors occurred: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`;
    console.warn("[generateGroups] Partial success:", warning);
    return { 
      success: true, 
      groupCount: savedCount,
      warning
    };
  }

  console.log("[generateGroups] Successfully completed. Generated", savedCount, "groups");
  return { success: true, groupCount: savedCount };
}

export async function updateGroupStatus(
  groupId: string,
  status: GroupStatus,
  eventSlug: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();

  // Get the group to find event_id
  const { data: group } = await supabase
    .from("suggested_groups")
    .select("event_id")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "Group not found" };
  }

  const auth = await validateAdminAccess(supabase, group.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("suggested_groups")
    .update({ status })
    .eq("id", groupId);

  if (error) return { error: "Failed to update group status" };

  // If group is approved, activate lockout for the event
  if (status === "approved") {
    // Check if there are any approved groups for this event
    const { data: approvedGroups } = await supabase
      .from("suggested_groups")
      .select("id")
      .eq("event_id", group.event_id)
      .eq("status", "approved");

    // If there are approved groups, activate lockout
    if (approvedGroups && approvedGroups.length > 0) {
      await supabase
        .from("events")
        .update({ seat_lockout_active: true })
        .eq("id", group.event_id);
    }
  }

  revalidatePath(getAdminGroupsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/agenda`);
  revalidatePath(`/${eventSlug}/`);
  return { success: true };
}

export async function updateGroupTableNumber(
  groupId: string,
  tableNumber: number | null,
  eventSlug: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();

  // Get the group to find event_id
  const { data: group } = await supabase
    .from("suggested_groups")
    .select("event_id")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "Group not found" };
  }

  const auth = await validateAdminAccess(supabase, group.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  const { error } = await supabase
    .from("suggested_groups")
    .update({ table_number: tableNumber })
    .eq("id", groupId);

  if (error) return { error: "Failed to update table number" };

  revalidatePath(getAdminGroupsPath(eventSlug, adminCode));
  return { success: true };
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
  eventSlug: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();

  // Get the group to find event_id
  const { data: group } = await supabase
    .from("suggested_groups")
    .select("event_id")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "Group not found" };
  }

  const auth = await validateAdminAccess(supabase, group.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  // Check how many members the group has
  const { data: memberCount } = await supabase
    .from("suggested_group_members")
    .select("id")
    .eq("group_id", groupId);

  if (memberCount && memberCount.length <= 2) {
    return { error: "Cannot remove member: group must have at least 2 members. Consider canceling the entire group instead." };
  }

  // Remove the member
  const { error } = await supabase
    .from("suggested_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    console.error("[removeGroupMember] Error:", error);
    return { error: "Failed to remove member from group" };
  }

  revalidatePath(getAdminGroupsPath(eventSlug, adminCode));
  return { success: true };
}

export async function addMemberToGroup(
  groupId: string,
  userId: string,
  eventSlug: string,
  matchReason?: string,
  adminCode?: string
) {
  const supabase = await createServiceClient();

  const { data: group } = await supabase
    .from("suggested_groups")
    .select("event_id, name, status")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "Group not found" };
  }

  const auth = await validateAdminAccess(supabase, group.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  // Check if user is already in this group
  const { data: existing } = await supabase
    .from("suggested_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return { error: "User is already in this group" };
  }

  // Check group size (max 6)
  const { data: members } = await supabase
    .from("suggested_group_members")
    .select("id")
    .eq("group_id", groupId);

  if (members && members.length >= 6) {
    return { error: "Group is full (max 6 members)" };
  }

  const { error } = await supabase
    .from("suggested_group_members")
    .insert({
      group_id: groupId,
      user_id: userId,
      match_reason: matchReason || "Late arrival — added to this table after group formation",
    });

  if (error) {
    console.error("[addMemberToGroup] Error:", error);
    return { error: "Failed to add member to group" };
  }

  console.log(`[addMemberToGroup] Added user ${userId} to group "${group.name}"`);
  revalidatePath(getAdminGroupsPath(eventSlug, adminCode));
  return { success: true };
}

/**
 * Auto-assign a late-arriving attendee to the least-full approved group.
 * Called during check-in when seat_lockout_active is true.
 * Returns the assigned group info or null if no groups available.
 */
export async function autoAssignLateArrival(
  eventId: string,
  userId: string
): Promise<{ groupId: string; groupName: string; tableNumber: number | null } | null> {
  const supabase = await createServiceClient();

  // Check if seating is enabled and seat lockout is active
  const { data: event } = await supabase
    .from("events")
    .select("seating_enabled, seat_lockout_active")
    .eq("id", eventId)
    .single();

  if (!event?.seating_enabled || !event.seat_lockout_active) return null;

  // Check if user is already assigned
  const { data: existingMembership } = await supabase
    .from("suggested_group_members")
    .select("group_id, group:suggested_groups(event_id, status)")
    .eq("user_id", userId);

  const alreadyAssigned = (existingMembership || []).some((m: any) => {
    const g = Array.isArray(m.group) ? m.group[0] : m.group;
    return g?.event_id === eventId && g?.status === "approved";
  });

  if (alreadyAssigned) return null;

  // Get all approved groups with member counts for this event
  const { data: approvedGroups } = await supabase
    .from("suggested_groups")
    .select("id, name, table_number, members:suggested_group_members(id)")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("table_number", { ascending: true });

  if (!approvedGroups || approvedGroups.length === 0) return null;

  // Find the least-full group that isn't at capacity (6)
  const groupsWithCounts = approvedGroups
    .map((g) => ({ ...g, memberCount: (g.members || []).length }))
    .filter((g) => g.memberCount < 6)
    .sort((a, b) => a.memberCount - b.memberCount);

  if (groupsWithCounts.length === 0) {
    console.log("[autoAssignLateArrival] All groups full, cannot auto-assign user", userId);
    return null;
  }

  const target = groupsWithCounts[0];

  // Insert membership
  const { error } = await supabase
    .from("suggested_group_members")
    .insert({
      group_id: target.id,
      user_id: userId,
      match_reason: "Late arrival — automatically assigned to this table",
    });

  if (error) {
    console.error("[autoAssignLateArrival] Error:", error);
    return null;
  }

  console.log(`[autoAssignLateArrival] Auto-assigned user ${userId} to "${target.name}" (Table ${target.table_number})`);
  return {
    groupId: target.id,
    groupName: target.name,
    tableNumber: target.table_number,
  };
}

export async function cancelGroup(groupId: string, eventSlug: string, adminCode?: string) {
  const supabase = await createServiceClient();

  // Get the group to find event_id
  const { data: group } = await supabase
    .from("suggested_groups")
    .select("event_id, status")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "Group not found" };
  }

  const auth = await validateAdminAccess(supabase, group.event_id, adminCode);
  if (!auth.valid) {
    return { error: auth.error || "Not authorized" };
  }

  // Delete the group members first (due to foreign key constraint)
  const { error: membersError } = await supabase
    .from("suggested_group_members")
    .delete()
    .eq("group_id", groupId);

  if (membersError) {
    console.error("[cancelGroup] Error deleting members:", membersError);
    return { error: "Failed to remove group members" };
  }

  // Delete the group itself
  const { error: groupError } = await supabase
    .from("suggested_groups")
    .delete()
    .eq("id", groupId);

  if (groupError) {
    console.error("[cancelGroup] Error deleting group:", groupError);
    return { error: "Failed to cancel group" };
  }

  // Check if there are any remaining approved groups
  const { data: remainingApproved } = await supabase
    .from("suggested_groups")
    .select("id")
    .eq("event_id", group.event_id)
    .eq("status", "approved");

  // If no more approved groups, deactivate lockout
  if (!remainingApproved || remainingApproved.length === 0) {
    await supabase
      .from("events")
      .update({ seat_lockout_active: false })
      .eq("id", group.event_id);
  }

  revalidatePath(getAdminGroupsPath(eventSlug, adminCode));
  revalidatePath(`/${eventSlug}/agenda`);
  revalidatePath(`/${eventSlug}/`);
  return { success: true };
}
