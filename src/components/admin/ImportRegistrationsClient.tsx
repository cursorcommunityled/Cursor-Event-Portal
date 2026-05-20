"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ImportRegistrationsClientProps {
  eventId: string;
  eventSlug: string;
  existingEmails: string[];
  adminCode?: string;
}

interface ParsedAttendee {
  name: string;
  email: string;
  status: "new" | "existing" | "invalid";
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

export function ImportRegistrationsClient({
  eventId,
  eventSlug,
  existingEmails,
  adminCode,
}: ImportRegistrationsClientProps) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedAttendee[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    skipped: number;
    profilesUpdated: number;
    errors: string[];
  } | null>(null);

  const existingSet = useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails]
  );

  // Parse Luma CSV/TSV format (handles both comma and tab delimiters)
  const parseCSV = useCallback(
    (text: string) => {
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        setParsed([]);
        return;
      }

      // Detect delimiter (tab or comma)
      const firstLine = lines[0];
      const delimiter = firstLine.includes("\t") ? "\t" : ",";

      // Find header row - Luma exports have headers like "name", "email", etc.
      const headerLine = lines[0].toLowerCase();
      const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/"/g, ""));

      const nameIdx = headers.findIndex(
        (h) => h === "name" || h === "full name" || h === "attendee name"
      );
      const firstNameIdx = headers.findIndex((h) => h === "first_name" || h === "first name");
      const lastNameIdx = headers.findIndex((h) => h === "last_name" || h === "last name");
      const emailIdx = headers.findIndex(
        (h) => h === "email" || h === "attendee email" || h === "email address"
      );
      const includesAny = (header: string, values: string[]) =>
        values.some((value) => header.includes(value));
      const includesAll = (header: string, values: string[]) =>
        values.every((value) => header.includes(value));
      const findHeader = (matcher: (header: string) => boolean) => headers.findIndex(matcher);

      const occupationIdx = findHeader((h) =>
        includesAny(h, ["occupation", "current role", "job title", "profession", "company"])
      );
      const technicalIdx = findHeader((h) =>
        includesAll(h, ["technical"]) ||
        includesAny(h, ["technical or non-technical", "technical/non-technical", "technical background"])
      );
      const skillIdx = findHeader((h) =>
        includesAny(h, ["unique thing", "unique skill", "teach someone", "pair you up", "superpower", "expertise"])
      );
      const linkedinIdx = findHeader((h) => h.includes("linkedin"));
      const needsTeamIdx = findHeader((h) =>
        includesAll(h, ["help", "team"]) ||
        includesAny(h, ["matched with a team", "looking for team", "need a team"])
      );
      const accessibilityIdx = findHeader((h) =>
        includesAny(h, ["accessibility", "accommodations", "special requests"])
      );
      const bioIdx = findHeader((h) =>
        includesAny(h, ["short bio", "bio", "about yourself", "introduce yourself", "background"])
      );
      const projectInterestsIdx = findHeader((h) =>
        includesAny(h, ["project interests", "project idea", "what are you building", "build", "solution", "track", "theme"])
      );
      const collaborationStyleIdx = findHeader((h) =>
        includesAny(h, ["collaboration style", "working style", "work style", "collaborate"])
      );
      const lookingForIdx = findHeader((h) =>
        includesAny(h, ["looking for", "teammate", "team mate", "need from teammates", "ideal teammate"])
      );

      if (emailIdx === -1) {
        // Try to find email column by content pattern
        setParsed([]);
        return;
      }

      const attendees: ParsedAttendee[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse line based on detected delimiter
        const values: string[] = [];

        if (delimiter === "\t") {
          // Tab-separated: simple split
          values.push(...line.split("\t").map((v) => v.trim().replace(/"/g, "")));
        } else {
          // Comma-separated: handle quoted fields
          let current = "";
          let inQuotes = false;

          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              values.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          values.push(current.trim());
        }

        const cleanValue = (index: number) =>
          index >= 0 ? values[index]?.replace(/^"|"$/g, "").trim() || undefined : undefined;

        const email = cleanValue(emailIdx)?.toLowerCase();

        // Build name: prefer "name" column, fall back to first_name + last_name
        let name = "";
        if (nameIdx >= 0 && values[nameIdx]) {
          name = values[nameIdx].replace(/"/g, "").trim();
        } else if (firstNameIdx >= 0 || lastNameIdx >= 0) {
          const firstName = firstNameIdx >= 0 ? values[firstNameIdx]?.replace(/"/g, "").trim() || "" : "";
          const lastName = lastNameIdx >= 0 ? values[lastNameIdx]?.replace(/"/g, "").trim() || "" : "";
          name = `${firstName} ${lastName}`.trim();
        }

        if (!name) {
          name = email?.split("@")[0] || "Unknown";
        }

        if (!email || !email.includes("@")) {
          continue; // Skip invalid emails
        }

        const status: "new" | "existing" | "invalid" = existingSet.has(email)
          ? "existing"
          : "new";

        const technicalRaw = cleanValue(technicalIdx)?.toLowerCase();
        const needsTeamRaw = cleanValue(needsTeamIdx)?.toLowerCase();

        attendees.push({
          name,
          email,
          status,
          occupation: cleanValue(occupationIdx),
          is_technical: technicalRaw
            ? technicalRaw.includes("non")
              ? false
              : technicalRaw.includes("technical")
                ? true
                : undefined
            : undefined,
          unique_skill: cleanValue(skillIdx),
          linkedin_url: cleanValue(linkedinIdx),
          needs_team: needsTeamRaw ? needsTeamRaw.includes("yes") : undefined,
          accessibility: cleanValue(accessibilityIdx),
          profile_bio: cleanValue(bioIdx),
          project_interests: cleanValue(projectInterestsIdx),
          collaboration_style: cleanValue(collaborationStyleIdx),
          looking_for_teammates: cleanValue(lookingForIdx),
        });
      }

      setParsed(attendees);
    },
    [existingSet]
  );

  const handleTextChange = (text: string) => {
    setCsvText(text);
    parseCSV(text);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const toImport = parsed.filter((a) => a.status === "new" || a.status === "existing");
    if (toImport.length === 0) return;

    setImporting(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/import-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminCode ? {
            "x-admin-code": adminCode,
            "x-event-id": eventId,
          } : {}),
        },
        body: JSON.stringify({
          eventId,
          attendees: toImport.map((a) => ({
            name: a.name,
            email: a.email,
            occupation: a.occupation,
            is_technical: a.is_technical,
            unique_skill: a.unique_skill,
            linkedin_url: a.linkedin_url,
            needs_team: a.needs_team,
            accessibility: a.accessibility,
            profile_bio: a.profile_bio,
            project_interests: a.project_interests,
            collaboration_style: a.collaboration_style,
            looking_for_teammates: a.looking_for_teammates,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: 0,
          skipped: toImport.length,
          profilesUpdated: 0,
          errors: [data.error || "Import failed"],
        });
      } else {
        setResult({
          success: data.imported || 0,
          skipped: data.skipped || 0,
          profilesUpdated: data.profilesUpdated || 0,
          errors: data.errors || [],
        });

        // Refresh the page to show updated registrations
        if (data.imported > 0 || data.profilesUpdated > 0) {
          router.refresh();
        }
      }
    } catch (error) {
      setResult({
        success: 0,
        skipped: toImport.length,
        profilesUpdated: 0,
        errors: ["Network error - please try again"],
      });
    } finally {
      setImporting(false);
    }
  };

  const newCount = parsed.filter((a) => a.status === "new").length;
  const existingCount = parsed.filter((a) => a.status === "existing").length;
  const importableCount = newCount + existingCount;
  const needsTeamCount = parsed.filter((a) => a.needs_team === true).length;
  const hasSurveyData = parsed.some(
    (a) =>
      a.occupation ||
      a.is_technical !== undefined ||
      a.unique_skill ||
      a.linkedin_url ||
      a.needs_team !== undefined ||
      a.accessibility
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* CSV Input */}
      <div className="glass rounded-[40px] p-10 border-white/[0.03] space-y-8">
        <div className="flex items-center gap-4">
          <h3 className="text-[11px] uppercase tracking-[0.5em] text-gray-700 font-medium">Source Material</h3>
          <div className="h-[1px] flex-1 bg-white/[0.03]" />
        </div>

        <div className="grid grid-cols-1 gap-8">
          <label className="group relative">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center cursor-pointer hover:bg-white/[0.02] hover:border-white/20 transition-all">
              <Upload className="w-10 h-10 mx-auto mb-4 text-gray-700 group-hover:text-white transition-colors" />
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600 group-hover:text-gray-400">
                Transmit CSV File
              </p>
            </div>
          </label>

          <div className="relative">
            <textarea
              placeholder={`Raw data input...\nname,email\nJohn Doe,john@example.com`}
              value={csvText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/20 transition-all text-sm font-mono min-h-[200px] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="glass rounded-[40px] p-10 border-white/[0.03] space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-[11px] uppercase tracking-[0.5em] text-gray-700 font-medium">Data Preview</h3>
              <div className="h-[1px] w-20 bg-white/[0.03]" />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-500">{newCount} New</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-500">{existingCount} Existing</span>
              </div>
              {needsTeamCount > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-400">{needsTeamCount} Need Team</span>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-6 text-[10px] uppercase tracking-[0.3em] text-gray-800 font-medium">Signal</th>
                  <th className="pb-6 text-[10px] uppercase tracking-[0.3em] text-gray-800 font-medium">Identity</th>
                  <th className="pb-6 text-[10px] uppercase tracking-[0.3em] text-gray-800 font-medium">Contact</th>
                  {hasSurveyData && (
                    <th className="pb-6 text-[10px] uppercase tracking-[0.3em] text-gray-800 font-medium">Profile</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {parsed.map((attendee, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-4">
                      {attendee.status === "new" ? (
                        <span className="text-emerald-500 text-[10px] font-bold tracking-widest uppercase bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10">Active</span>
                      ) : (
                        <span className="text-gray-700 text-[10px] font-bold tracking-widest uppercase bg-white/[0.02] px-3 py-1 rounded-full border border-white/[0.05]">Redundant</span>
                      )}
                    </td>
                    <td className="py-4 text-sm font-light tracking-tight text-white/90">{attendee.name}</td>
                    <td className="py-4 text-[10px] font-medium tracking-[0.1em] text-gray-700 uppercase">{attendee.email}</td>
                    {hasSurveyData && (
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {attendee.is_technical !== undefined && (
                            <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${
                              attendee.is_technical
                                ? "text-red-400 bg-red-500/5 border-red-500/15"
                                : "text-orange-400 bg-orange-500/5 border-orange-500/15"
                            }`}>
                              {attendee.is_technical ? "Tech" : "Non-Tech"}
                            </span>
                          )}
                          {attendee.needs_team && (
                            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border text-red-400 bg-red-500/5 border-red-500/15">
                              Needs Team
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Result */}
      {result && (
        <div className={`glass rounded-[32px] p-8 border ${
          result.success > 0 || result.profilesUpdated > 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
        }`}>
          <div className="flex items-start gap-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              result.success > 0 || result.profilesUpdated > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            }`}>
              {result.success > 0 || result.profilesUpdated > 0 ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div className="space-y-2">
              <p className="text-lg font-light tracking-tight">
                {result.success > 0 || result.profilesUpdated > 0
                  ? `Successfully synchronized ${result.success} identities and ${result.profilesUpdated} profiles`
                  : "Synchronization failed"}
              </p>
              {result.skipped > 0 && (
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-700 font-medium">
                  {result.skipped} Redundancies detected and bypassed
                </p>
              )}
              {result.errors.length > 0 && (
                <div className="pt-2 space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-[10px] text-red-400 font-medium uppercase tracking-tight">• {err}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-6">
        <button
          onClick={handleImport}
          disabled={importableCount === 0 || importing}
          className={`flex-1 h-16 rounded-full font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 ${
            importableCount === 0 || importing
              ? "bg-white/5 text-white/10 cursor-not-allowed"
              : "bg-white text-black hover:scale-[1.02] shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
          }`}
        >
          {importing ? (
            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              Ingest {importableCount} Identities
            </>
          )}
        </button>
        <button
          onClick={() => {
            setCsvText("");
            setParsed([]);
            setResult(null);
          }}
          className="px-10 h-16 rounded-full bg-white/[0.02] border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/5 transition-all"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
