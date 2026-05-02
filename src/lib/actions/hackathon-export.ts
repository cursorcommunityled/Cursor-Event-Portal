"use server";

import { createServiceClient } from "@/lib/supabase/server";

interface ExportResult {
  eventSlug?: string;
  created?: number;
  errors?: string[];
  error?: string;
}

export async function exportCompetitionToHackathonJudge(
  competitionId: string
): Promise<ExportResult> {
  const hjUrl = process.env.HACKATHON_JUDGE_URL;
  const hjSecret = process.env.HACKATHON_JUDGE_IMPORT_SECRET;

  if (!hjUrl || !hjSecret) {
    return { error: "Hackathon Judge integration not configured on this server." };
  }

  const supabase = createServiceClient();

  const { data: comp, error: compError } = await supabase
    .from("competitions")
    .select(`
      id, title,
      competition_entries (
        id, title, description, repo_url, project_url, preview_image_url
      )
    `)
    .eq("id", competitionId)
    .single();

  if (compError || !comp) {
    return { error: compError?.message ?? "Competition not found." };
  }

  const entries = (comp as any).competition_entries ?? [];
  if (entries.length === 0) {
    return { error: "No entries to export." };
  }

  const submissions = entries.map((entry: any) => ({
    teamName: entry.title,
    githubUrl: entry.repo_url,
    pitchText: entry.description ?? undefined,
    projectUrl: entry.project_url ?? undefined,
    previewImageUrl: entry.preview_image_url ?? undefined,
  }));

  const eventDate = new Date().toISOString().split("T")[0];

  try {
    const res = await fetch(`${hjUrl}/api/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-import-secret": hjSecret,
      },
      body: JSON.stringify({ eventName: comp.title, eventDate, submissions }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error ?? "Export failed." };
    }

    return { eventSlug: data.eventSlug, created: data.created, errors: data.errors ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error reaching Hackathon Judge." };
  }
}
