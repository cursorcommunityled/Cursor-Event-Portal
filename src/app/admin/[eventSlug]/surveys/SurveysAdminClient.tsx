"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { createSurvey, publishSurvey, unpublishSurvey, deleteSurvey, createDefaultSurvey, toggleSurveyPopup } from "@/lib/actions/survey";
import type { Event, Survey, SurveyField } from "@/types";
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, CheckCircle, ClipboardCheck, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface SurveysAdminClientProps {
  event: Event;
  eventSlug: string;
  adminCode?: string;
  initialSurveys: Survey[];
  isEmbedded?: boolean;
}

export function SurveysAdminClient({
  event,
  eventSlug,
  adminCode,
  initialSurveys,
  isEmbedded = false,
}: SurveysAdminClientProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState(initialSurveys);
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popupVisible, setPopupVisible] = useState(event.survey_popup_visible ?? false);

  const handleTogglePopup = async () => {
    const newValue = !popupVisible;
    setPopupVisible(newValue); // Optimistic update
    setError(null);
    startTransition(async () => {
      const result = await toggleSurveyPopup(event.id, eventSlug, newValue, adminCode);
      if (!result.success) {
        setPopupVisible(!newValue); // Revert on failure
        setError(result.error || "Failed to toggle survey popup");
      }
      router.refresh();
    });
  };

  const handlePublish = async (surveyId: string) => {
    setError(null);
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
        setError(result.error || "Failed to publish survey");
      }
    });
  };

  const handleUnpublish = async (surveyId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await unpublishSurvey(surveyId, eventSlug, adminCode);
      if (result.success) {
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === surveyId ? { ...s, published_at: null } : s
          )
        );
        router.refresh();
      } else {
        setError(result.error || "Failed to unpublish survey");
      }
    });
  };

  const handleDelete = async (surveyId: string) => {
    if (!confirm("Are you sure you want to delete this survey? This cannot be undone.")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteSurvey(surveyId, eventSlug, adminCode);
      if (result.success) {
        setSurveys((prev) => prev.filter((s) => s.id !== surveyId));
        router.refresh();
      } else {
        setError(result.error || "Failed to delete survey");
      }
    });
  };

  const handleCreate = async (data: { title: string; schema: { fields: SurveyField[] } }) => {
    setError(null);
    startTransition(async () => {
      const result = await createSurvey(event.id, eventSlug, data.title, data.schema, adminCode);
      if (result.success) {
        router.refresh();
        setShowCreateModal(false);
      } else {
        setError(result.error || "Failed to create survey");
      }
    });
  };

  const handleCreateDefault = async () => {
    setError(null);
    startTransition(async () => {
      const result = await createDefaultSurvey(event.id, eventSlug, adminCode);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "Failed to create default survey");
      }
    });
  };

  const publishedSurvey = surveys.find((s) => s.published_at);
  const draftSurveys = surveys.filter((s) => !s.published_at);

  const content = (
    <main className={cn("max-w-4xl mx-auto px-6 py-12 space-y-12 animate-fade-in", isEmbedded && "py-0")}>
      {/* Error Message */}
      {error && (
        <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Published Survey */}
      {publishedSurvey && (
        <div className="glass rounded-[40px] p-10 border-green-500/20 bg-green-500/5">
          {/* Survey Popup Toggle */}
          <div className="flex items-center justify-between mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${popupVisible ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-600'}`}>
                {popupVisible ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm text-white font-medium">Survey Alert</p>
                <p className="text-[10px] text-gray-600">
                  {popupVisible ? 'Attendees see a popup to fill survey' : 'Popup hidden from attendees'}
                </p>
              </div>
            </div>
            <button
              onClick={handleTogglePopup}
              disabled={isPending}
              className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                popupVisible
                  ? 'bg-green-500/30 border border-green-500/50'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full transition-all duration-300 ${
                popupVisible
                  ? 'left-7 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                  : 'left-1 bg-gray-600'
              }`} />
            </button>
          </div>

          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] uppercase tracking-[0.15em] font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Published
                </span>
                <span className="text-[9px] text-gray-700">
                  Live on feedback page
                </span>
              </div>
              <h2 className="text-3xl font-light tracking-tight text-white/90 mb-2">
                {publishedSurvey.title}
              </h2>
              <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">
                {publishedSurvey.schema.fields.length} Questions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleUnpublish(publishedSurvey.id)}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-600 hover:text-white hover:border-white/20 transition-all text-[10px] uppercase tracking-[0.2em] font-bold"
              >
                <EyeOff className="w-4 h-4 inline mr-2" />
                Unpublish
              </button>
              <button
                onClick={() => handleDelete(publishedSurvey.id)}
                disabled={isPending}
                className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-800 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {publishedSurvey.schema.fields.map((field, idx) => (
              <div key={field.id} className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.02]">
                <p className="text-sm text-white/70 font-light">
                  {idx + 1}. {field.label} {field.required && <span className="text-gray-700">*</span>}
                </p>
                <p className="text-[9px] text-gray-700 uppercase tracking-[0.2em] mt-1">
                  {field.type}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Surveys - Show Quick Start */}
      {surveys.length === 0 && (
        <div className="glass rounded-[40px] p-12 border-dashed border-white/10 text-center space-y-6">
          <ClipboardCheck className="w-12 h-12 mx-auto text-gray-700" />
          <div className="space-y-2">
            <h3 className="text-xl font-light text-white/90">No surveys yet</h3>
            <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">
              Get started by creating a default feedback survey
            </p>
          </div>
          <button
            onClick={handleCreateDefault}
            disabled={isPending}
            className="px-8 py-4 rounded-2xl bg-white text-black hover:bg-gray-200 transition-all text-[10px] uppercase tracking-[0.2em] font-bold shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Creating..." : "Create Default Survey"}
          </button>
          <p className="text-[9px] text-gray-800 pt-2">
            Or create a custom survey using the + button above
          </p>
        </div>
      )}

      {/* Draft Surveys */}
      {surveys.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-4 px-2">
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
              {draftSurveys.length > 0 ? "Draft Surveys" : "No Drafts"}
            </p>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
          </div>

          {draftSurveys.length === 0 ? (
            <div className="text-center py-24 glass rounded-[40px] border-dashed border-white/5 opacity-40">
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
                No draft surveys
              </p>
            </div>
          ) : (
          <div className="space-y-6">
            {draftSurveys.map((survey) => (
              <div
                key={survey.id}
                className="glass rounded-[40px] p-10 border-white/[0.03] hover:bg-white/[0.01] transition-all"
              >
                <div className="flex items-start justify-between gap-6 mb-6">
                  <div className="flex-1">
                    <h3 className="text-2xl font-light tracking-tight text-white/90 mb-2">
                      {survey.title}
                    </h3>
                    <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">
                      {survey.schema.fields.length} Questions · Created {new Date(survey.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePublish(survey.id)}
                      disabled={isPending}
                      className="px-6 py-3 rounded-2xl bg-white text-black hover:bg-gray-200 transition-all text-[10px] uppercase tracking-[0.2em] font-bold shadow-xl"
                    >
                      <Eye className="w-4 h-4 inline mr-2" />
                      Publish
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id)}
                      disabled={isPending}
                      className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-800 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {survey.schema.fields.slice(0, 3).map((field, idx) => (
                    <div key={field.id} className="p-3 rounded-xl bg-white/[0.01] border border-white/[0.02]">
                      <p className="text-xs text-white/60 font-light">
                        {idx + 1}. {field.label}
                      </p>
                    </div>
                  ))}
                  {survey.schema.fields.length > 3 && (
                    <p className="text-[9px] text-gray-700 text-center pt-2">
                      +{survey.schema.fields.length - 3} more questions
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </main>
  );

  if (isEmbedded) {
    return (
      <>
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all shadow-xl"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {content}
        {showCreateModal && (
          <CreateSurveyModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreate}
            isPending={isPending}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <AdminHeader 
        eventSlug={eventSlug}
        adminCode={adminCode}
        subtitle="Survey Management"
        rightElement={
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all shadow-xl"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      {content}

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Surveys</p>
        </div>
      </footer>

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

  const addField = () => {
    setFields([
      ...fields,
      {
        id: `field-${Date.now()}`,
        type: "text",
        label: `Question ${fields.length + 1}`,
        required: false,
      },
    ]);
  };

  const removeField = (id: string) => {
    if (fields.length > 1) {
      setFields(fields.filter((f) => f.id !== id));
    }
  };

  const updateField = (id: string, updates: Partial<SurveyField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Survey title is required");
      return;
    }

    if (fields.length === 0) {
      setError("At least one question is required");
      return;
    }

    onCreate({ title: title.trim(), schema: { fields } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div className="glass rounded-[40px] p-10 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight">Create Survey</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white transition-all flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em] mb-3 block">
              Survey Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event Feedback Survey"
              className="w-full bg-transparent border-b border-white/10 rounded-none py-4 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-xl font-light"
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em]">
                Questions
              </label>
              <button
                type="button"
                onClick={addField}
                className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white transition-all text-[10px] uppercase tracking-[0.2em] font-bold"
              >
                + Add Question
              </button>
            </div>

            {fields.map((field, idx) => (
              <div key={field.id} className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.02] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">
                    Question {idx + 1}
                  </span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="text-gray-700 hover:text-red-500 transition-colors text-[10px] uppercase tracking-[0.2em]"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder="Question text"
                  className="w-full bg-transparent border-b border-white/10 rounded-none py-3 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-lg font-light"
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
                    <label className="text-[9px] text-gray-700 uppercase tracking-[0.2em] block mb-2">
                      Options (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(", ") || ""}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                        })
                      }
                      placeholder="Option 1, Option 2, Option 3"
                      className="w-full bg-transparent border-b border-white/10 rounded-none py-2 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-sm font-light"
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
