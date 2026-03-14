"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck, Bell, BellOff, Eye, EyeOff, Trash2, Plus,
  Send, CheckCircle, Users, BarChart2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSurvey, publishSurvey, unpublishSurvey, deleteSurvey,
  createDefaultSurvey, toggleSurveyPopup, getSurveyResponseCount,
} from "@/lib/actions/survey";
import {
  getPostEventEmailStats, sendPostEventEmails,
  type PostEventEmailMode,
} from "@/lib/actions/post-event-emails";
import type { Event, Survey, SurveyField } from "@/types";

interface FollowUpAdminClientProps {
  event: Event;
  eventSlug: string;
  adminCode: string;
  initialSurveys: Survey[];
}

type EmailMode = PostEventEmailMode;

const EMAIL_MODES: Array<{
  id: EmailMode;
  label: string;
  sublabel: string;
  description: string;
  icon: string;
}> = [
  {
    id: "host-blast",
    label: "Host Thank-You",
    sublabel: "Warm wrap-up from the organizer",
    description: "Sends a warm thank-you email to each attendee showing who they sat with and their profile links.",
    icon: "✉️",
  },
  {
    id: "survey",
    label: "Survey Email",
    sublabel: "Send published survey to attendees",
    description: "Includes a prominent link to your published in-app survey. Also lists each attendee's groupmates.",
    icon: "📋",
  },
  {
    id: "connection-recommend",
    label: "Connection Intros",
    sublabel: "Personalized match introductions",
    description: "Each attendee receives a personalized email introducing their groupmates with AI-generated match reasons and profile links.",
    icon: "🤝",
  },
];

export function FollowUpAdminClient({
  event,
  eventSlug,
  adminCode,
  initialSurveys,
}: FollowUpAdminClientProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState(initialSurveys);
  const [isPending, startTransition] = useTransition();
  const [popupVisible, setPopupVisible] = useState(event.survey_popup_visible ?? false);
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Email section state
  const [selectedMode, setSelectedMode] = useState<EmailMode>("host-blast");
  const [emailStats, setEmailStats] = useState<{ groups: number; totalMembers: number; eligibleRecipients: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; skipped: number; errors: string[] } | null>(null);

  const publishedSurvey = surveys.find((s) => s.published_at);
  const draftSurveys = surveys.filter((s) => !s.published_at);

  // Survey URL — auto-fill from in-app survey; falls back to custom input
  const defaultSurveyUrl = publishedSurvey
    ? `${process.env.NEXT_PUBLIC_BASE_URL || ""}/${eventSlug}/feedback`
    : "";
  const [surveyUrl, setSurveyUrl] = useState(defaultSurveyUrl);

  // Keep survey URL in sync if published survey changes
  useEffect(() => {
    if (publishedSurvey && !surveyUrl) {
      setSurveyUrl(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/${eventSlug}/feedback`);
    }
  }, [publishedSurvey, eventSlug, surveyUrl]);

  // Fetch response count for published survey
  useEffect(() => {
    if (!publishedSurvey) return;
    getSurveyResponseCount(publishedSurvey.id).then(setResponseCount);
  }, [publishedSurvey?.id]);

  // Fetch email stats
  useEffect(() => {
    setStatsLoading(true);
    getPostEventEmailStats(event.id, adminCode)
      .then((s) => {
        if (!("error" in s)) setEmailStats(s);
      })
      .finally(() => setStatsLoading(false));
  }, [event.id, adminCode]);

  // ── Survey actions ────────────────────────────────────────────────────────

  const handleTogglePopup = () => {
    const newValue = !popupVisible;
    setPopupVisible(newValue);
    startTransition(async () => {
      const result = await toggleSurveyPopup(event.id, eventSlug, newValue, adminCode);
      if (!result.success) {
        setPopupVisible(!newValue);
        setFormError(result.error || "Failed to toggle popup");
      }
      router.refresh();
    });
  };

  const handlePublish = (surveyId: string) => {
    setFormError(null);
    startTransition(async () => {
      const result = await publishSurvey(surveyId, eventSlug, adminCode);
      if (result.success) {
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === surveyId
              ? { ...s, published_at: new Date().toISOString() }
              : { ...s, published_at: null }
          )
        );
        router.refresh();
      } else {
        setFormError(result.error || "Failed to publish");
      }
    });
  };

  const handleUnpublish = (surveyId: string) => {
    setFormError(null);
    startTransition(async () => {
      const result = await unpublishSurvey(surveyId, eventSlug, adminCode);
      if (result.success) {
        setSurveys((prev) => prev.map((s) => s.id === surveyId ? { ...s, published_at: null } : s));
        router.refresh();
      } else {
        setFormError(result.error || "Failed to unpublish");
      }
    });
  };

  const handleDelete = (surveyId: string) => {
    if (!confirm("Delete this survey? This cannot be undone.")) return;
    setFormError(null);
    startTransition(async () => {
      const result = await deleteSurvey(surveyId, eventSlug, adminCode);
      if (result.success) {
        setSurveys((prev) => prev.filter((s) => s.id !== surveyId));
        router.refresh();
      } else {
        setFormError(result.error || "Failed to delete");
      }
    });
  };

  const handleCreate = (data: { title: string; schema: { fields: SurveyField[] } }) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createSurvey(event.id, eventSlug, data.title, data.schema, adminCode);
      if (result.success) {
        router.refresh();
        setShowCreateModal(false);
      } else {
        setFormError(result.error || "Failed to create survey");
      }
    });
  };

  const handleCreateDefault = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await createDefaultSurvey(event.id, eventSlug, adminCode);
      if (result.success) router.refresh();
      else setFormError(result.error || "Failed to create default survey");
    });
  };

  // ── Email actions ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!sendConfirmed) { setSendConfirmed(true); return; }
    setSending(true);
    setSendResult(null);
    try {
      const result = await sendPostEventEmails(event.id, adminCode, selectedMode, { surveyUrl });
      setSendResult(result);
    } finally {
      setSending(false);
      setSendConfirmed(false);
    }
  };

  const activeEmailMode = EMAIL_MODES.find((m) => m.id === selectedMode)!;
  const canSend =
    !statsLoading &&
    emailStats !== null &&
    emailStats.eligibleRecipients > 0 &&
    (selectedMode !== "survey" || surveyUrl.trim().length > 0);

  return (
    <div className="space-y-10 pb-20">

      {/* ── SURVEY SECTION ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">In-App Survey</p>
            <p className="text-xs text-gray-700 mt-0.5">Build and publish a survey attendees fill inside the app</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {formError && (
          <div className="glass rounded-2xl p-4 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{formError}</p>
          </div>
        )}

        {/* Published survey */}
        {publishedSurvey ? (
          <div className="glass rounded-[32px] p-7 border border-green-500/20 bg-green-500/[0.03] space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-[9px] uppercase tracking-[0.15em] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                  {responseCount !== null && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-gray-500 text-[9px] uppercase tracking-[0.15em] font-medium">
                      <BarChart2 className="w-3 h-3" />
                      {responseCount} response{responseCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-light text-white/90">{publishedSurvey.title}</h3>
                <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-[0.15em]">
                  {publishedSurvey.schema.fields.length} questions · /{eventSlug}/feedback
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleUnpublish(publishedSurvey.id)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-all text-[9px] uppercase tracking-[0.2em] font-bold"
                >
                  <EyeOff className="w-3.5 h-3.5 inline mr-1.5" />
                  Unpublish
                </button>
                <button
                  onClick={() => handleDelete(publishedSurvey.id)}
                  disabled={isPending}
                  className="w-9 h-9 rounded-xl bg-white/[0.02] border border-white/5 text-gray-700 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Survey popup toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", popupVisible ? "bg-green-500/20 text-green-400" : "bg-white/5 text-gray-600")}>
                  {popupVisible ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs text-white/80 font-medium">Survey Alert Popup</p>
                  <p className="text-[10px] text-gray-600">
                    {popupVisible ? "Attendees see a prompt to fill the survey" : "Hidden from attendees"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTogglePopup}
                disabled={isPending}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-all duration-300",
                  popupVisible ? "bg-green-500/30 border border-green-500/50" : "bg-white/5 border border-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300",
                  popupVisible ? "left-6 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "left-0.5 bg-gray-600"
                )} />
              </button>
            </div>

            {/* Question preview */}
            <div className="space-y-2">
              {publishedSurvey.schema.fields.slice(0, 3).map((field, idx) => (
                <div key={field.id} className="px-4 py-2.5 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <p className="text-xs text-white/60 font-light">{idx + 1}. {field.label}</p>
                  <p className="text-[9px] text-gray-700 uppercase tracking-[0.15em] mt-0.5">{field.type}</p>
                </div>
              ))}
              {publishedSurvey.schema.fields.length > 3 && (
                <p className="text-[9px] text-gray-700 text-center pt-1">
                  +{publishedSurvey.schema.fields.length - 3} more questions
                </p>
              )}
            </div>
          </div>
        ) : surveys.length === 0 ? (
          /* Empty state */
          <div className="glass rounded-[32px] p-10 border border-dashed border-white/10 text-center space-y-5">
            <ClipboardCheck className="w-10 h-10 mx-auto text-gray-700" />
            <div className="space-y-1.5">
              <p className="text-sm font-light text-white/80">No survey yet</p>
              <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">Create one to start collecting feedback</p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleCreateDefault}
                disabled={isPending}
                className="px-6 py-3 rounded-full bg-white text-black text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/90 transition-all shadow-glow disabled:opacity-40"
              >
                {isPending ? "Creating..." : "Create Default Survey"}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-gray-500 hover:text-white text-[10px] uppercase tracking-[0.2em] font-bold transition-all"
              >
                Custom
              </button>
            </div>
          </div>
        ) : null}

        {/* Draft surveys */}
        {draftSurveys.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 font-medium px-1">Drafts</p>
            {draftSurveys.map((survey) => (
              <div key={survey.id} className="glass rounded-[24px] p-5 border border-white/[0.05] flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-light text-white/80">{survey.title}</p>
                  <p className="text-[9px] text-gray-600 uppercase tracking-[0.15em] mt-0.5">
                    {survey.schema.fields.length} questions · Draft
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handlePublish(survey.id)}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl bg-white text-black text-[9px] uppercase tracking-[0.2em] font-bold hover:bg-white/90 transition-all"
                  >
                    <Eye className="w-3 h-3 inline mr-1" />
                    Publish
                  </button>
                  <button
                    onClick={() => handleDelete(survey.id)}
                    disabled={isPending}
                    className="w-8 h-8 rounded-xl bg-white/[0.02] border border-white/5 text-gray-700 hover:text-red-500 transition-all flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-[1px] flex-1 bg-white/[0.04]" />
        <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 font-medium">Email Outreach</p>
        <div className="h-[1px] flex-1 bg-white/[0.04]" />
      </div>

      {/* ── EMAIL SECTION ──────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Recipient stats */}
        <div className="glass rounded-2xl p-5 border border-white/10 grid grid-cols-3 gap-4 text-center">
          {statsLoading ? (
            <div className="col-span-3 flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : emailStats ? (
            <>
              <div>
                <p className="text-2xl font-light text-white">{emailStats.groups}</p>
                <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-medium mt-1">Groups</p>
              </div>
              <div>
                <p className="text-2xl font-light text-white">{emailStats.totalMembers}</p>
                <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-medium mt-1">Attendees</p>
              </div>
              <div>
                <p className="text-2xl font-light text-white">{emailStats.eligibleRecipients}</p>
                <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-medium mt-1">Will Receive</p>
              </div>
            </>
          ) : (
            <div className="col-span-3 text-sm text-gray-600">Could not load stats</div>
          )}
        </div>

        {emailStats?.eligibleRecipients === 0 && !statsLoading && (
          <p className="text-xs text-yellow-400/80 text-center">
            No eligible recipients — approve groups and ensure attendees consented to follow-up emails.
          </p>
        )}

        {/* Mode selector */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-medium">Email Type</p>
          {EMAIL_MODES.map((mode) => {
            const isActive = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => { setSelectedMode(mode.id); setSendResult(null); setSendConfirmed(false); }}
                className={cn(
                  "w-full text-left glass rounded-2xl p-5 border transition-all duration-200",
                  isActive ? "border-white/25 bg-white/[0.05]" : "border-white/[0.06] hover:border-white/15"
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="text-xl mt-0.5">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{mode.label}</span>
                      <span className="text-[9px] uppercase tracking-[0.14em] text-gray-500">{mode.sublabel}</span>
                      {isActive && <span className="ml-auto text-[9px] uppercase tracking-[0.14em] text-white/50 font-bold">Selected</span>}
                    </div>
                    {isActive && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{mode.description}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Survey URL — auto-filled if published survey exists, editable */}
        {selectedMode === "survey" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-medium block">
                Survey URL
              </label>
              {publishedSurvey && (
                <button
                  onClick={() => setSurveyUrl(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/${eventSlug}/feedback`)}
                  className="text-[9px] uppercase tracking-[0.15em] text-gray-600 hover:text-white transition-colors"
                >
                  Use in-app survey ↩
                </button>
              )}
            </div>
            <input
              type="url"
              value={surveyUrl}
              onChange={(e) => setSurveyUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
            />
            {publishedSurvey && surveyUrl.includes("/feedback") && (
              <p className="text-[9px] text-gray-700">
                Auto-filled from your published in-app survey
              </p>
            )}
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div className={cn(
            "glass rounded-2xl p-4 border text-sm space-y-1.5",
            sendResult.errors.length > 0 ? "border-yellow-400/20" : "border-green-400/20"
          )}>
            <p className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Send Result</p>
            <p className="text-green-400">✓ {sendResult.sent} email{sendResult.sent !== 1 ? "s" : ""} sent</p>
            {sendResult.skipped > 0 && <p className="text-gray-400">↷ {sendResult.skipped} skipped</p>}
            {sendResult.errors.map((e, i) => <p key={i} className="text-red-400 text-xs">✗ {e}</p>)}
          </div>
        )}

        {/* Send button */}
        <div className="flex justify-end gap-3">
          {sendConfirmed && !sending && (
            <button
              onClick={() => setSendConfirmed(false)}
              className="px-6 py-3 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className={cn(
              "px-8 py-3 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2",
              sendConfirmed
                ? "bg-red-500 text-white hover:bg-red-400"
                : canSend
                ? "bg-white text-black hover:bg-white/90 shadow-glow"
                : "bg-white/10 text-gray-600 cursor-not-allowed"
            )}
          >
            <Send className="w-3.5 h-3.5" />
            {sending
              ? "Sending..."
              : sendConfirmed
              ? `Confirm — send to ${emailStats?.eligibleRecipients ?? 0}`
              : `Send ${activeEmailMode.label}`}
          </button>
        </div>
      </div>

      {/* Create Survey Modal */}
      {showCreateModal && (
        <CreateSurveyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// ── Create Survey Modal ─────────────────────────────────────────────────────

interface CreateSurveyModalProps {
  onClose: () => void;
  onCreate: (data: { title: string; schema: { fields: SurveyField[] } }) => void;
  isPending: boolean;
}

function CreateSurveyModal({ onClose, onCreate, isPending }: CreateSurveyModalProps) {
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<SurveyField[]>([
    { id: "field-1", type: "text", label: "Question 1", required: false },
  ]);
  const [error, setError] = useState<string | null>(null);

  const addField = () => setFields([
    ...fields,
    { id: `field-${Date.now()}`, type: "text", label: `Question ${fields.length + 1}`, required: false },
  ]);

  const removeField = (id: string) => {
    if (fields.length > 1) setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<SurveyField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Survey title is required"); return; }
    if (fields.length === 0) { setError("At least one question is required"); return; }
    onCreate({ title: title.trim(), schema: { fields } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div className="glass rounded-[40px] p-10 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight">Create Survey</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white transition-all flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em] mb-3 block">Survey Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event Feedback Survey"
              className="w-full bg-transparent border-b border-white/10 py-4 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-xl font-light"
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em]">Questions</label>
              <button type="button" onClick={addField} className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white transition-all text-[10px] uppercase tracking-[0.2em] font-bold">
                + Add Question
              </button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.02] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">Question {idx + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => removeField(field.id)} className="text-gray-700 hover:text-red-500 transition-colors text-[10px] uppercase tracking-[0.2em]">
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder="Question text"
                  className="w-full bg-transparent border-b border-white/10 py-3 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-lg font-light"
                />
                <div className="flex items-center gap-6">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as SurveyField["type"] })}
                    className="bg-transparent border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                  >
                    <option value="text" className="bg-black">Text</option>
                    <option value="textarea" className="bg-black">Textarea</option>
                    <option value="rating" className="bg-black">Rating (1-5)</option>
                    <option value="nps" className="bg-black">NPS (0-10)</option>
                    <option value="select" className="bg-black">Select</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      className="w-4 h-4 rounded border-white/10 bg-transparent"
                    />
                    Required
                  </label>
                </div>
                {(field.type === "select" || field.type === "multiselect") && (
                  <div>
                    <label className="text-[9px] text-gray-700 uppercase tracking-[0.2em] block mb-2">Options (comma-separated)</label>
                    <input
                      type="text"
                      value={field.options?.join(", ") || ""}
                      onChange={(e) => updateField(field.id, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                      placeholder="Option 1, Option 2, Option 3"
                      className="w-full bg-transparent border-b border-white/10 py-2 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-sm font-light"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-14 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 transition-all shadow-xl"
            >
              {isPending ? "Creating..." : "Create Survey"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-8 h-14 rounded-full bg-white/[0.03] border border-white/5 text-gray-600 hover:text-white transition-all text-[10px] uppercase tracking-[0.2em] font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
