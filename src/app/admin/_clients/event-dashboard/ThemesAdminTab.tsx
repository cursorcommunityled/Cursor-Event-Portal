"use client";

import { useState } from "react";
import { selectEventTheme, clearEventTheme, createConversationTheme } from "@/lib/actions/event-dashboard";
import { cn } from "@/lib/utils";
import { Sparkles, Check, X, Plus } from "lucide-react";
import type { ConversationTheme, EventThemeSelection } from "@/types";

interface ThemesAdminTabProps {
  eventId: string;
  adminCode: string;
  themes: ConversationTheme[];
  initialSelection: EventThemeSelection | null;
}

export function ThemesAdminTab({
  eventId,
  adminCode,
  themes,
  initialSelection,
}: ThemesAdminTabProps) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(
    initialSelection?.theme_id ?? null
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [localThemes, setLocalThemes] = useState<ConversationTheme[]>(themes);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", emoji: "", category: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const handleSelect = async (themeId: string) => {
    if (loading) return;
    if (activeThemeId === themeId) {
      // Deselect
      setLoading("clear");
      const result = await clearEventTheme(eventId, adminCode);
      if (!result.error) setActiveThemeId(null);
      setLoading(null);
      return;
    }
    setLoading(themeId);
    const result = await selectEventTheme(eventId, themeId, adminCode);
    if (!result.error) setActiveThemeId(themeId);
    setLoading(null);
  };

  const handleAddTheme = async () => {
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    setFormSaving(true);
    setFormError(null);
    const result = await createConversationTheme({
      name: form.name.trim(),
      description: form.description.trim() || null,
      emoji: form.emoji.trim() || null,
      category: form.category.trim() || null,
    });
    setFormSaving(false);
    if (result.error) { setFormError(result.error); return; }
    if (result.data) setLocalThemes((prev) => [...prev, result.data as ConversationTheme]);
    setForm({ name: "", description: "", emoji: "", category: "" });
    setShowForm(false);
  };

  // Group by category
  const categories = Array.from(new Set(localThemes.map((t) => t.category ?? "General")));

  const activeTheme = localThemes.find((t) => t.id === activeThemeId);

  return (
    <div className="space-y-8">
      {/* Active theme banner */}
      {activeTheme ? (
        <div className="glass rounded-3xl p-6 border-white/30 bg-white/5 shadow-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{activeTheme.emoji ?? "🎯"}</span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-medium mb-1">
                  Tonight&apos;s Theme
                </p>
                <h3 className="text-xl font-light text-white">{activeTheme.name}</h3>
                {activeTheme.description && (
                  <p className="text-sm text-gray-400 mt-0.5">{activeTheme.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleSelect(activeTheme.id)}
              disabled={!!loading}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
              title="Clear theme"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-6 border-white/10 text-center">
          <Sparkles className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No theme selected — pick one below</p>
        </div>
      )}

      {/* Theme grid, grouped by category */}
      {categories.map((cat) => {
        const catThemes = localThemes.filter((t) => (t.category ?? "General") === cat);
        return (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-medium mb-4">
              {cat}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catThemes.map((theme) => {
                const isActive = activeThemeId === theme.id;
                const isLoading = loading === theme.id;
                const isUsed = (theme.times_used ?? 0) > 0 && !isActive;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelect(theme.id)}
                    disabled={!!loading}
                    className={cn(
                      "group glass rounded-2xl p-5 text-left transition-all duration-300 border relative",
                      isActive
                        ? "border-white/40 bg-white/10 shadow-glow scale-[1.01]"
                        : isUsed
                        ? "border-white/5 opacity-40 cursor-pointer hover:opacity-60"
                        : "border-white/10 hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    {isUsed && (
                      <span className="absolute top-3 right-3 text-[9px] uppercase tracking-widest text-gray-600 font-medium">
                        Used
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={cn("text-2xl shrink-0 mt-0.5", isUsed && "grayscale")}>
                          {theme.emoji ?? "💡"}
                        </span>
                        <div className="min-w-0">
                          <h4 className={cn(
                            "font-medium text-base leading-snug",
                            isActive ? "text-white" : isUsed ? "text-gray-600" : "text-white/80 group-hover:text-white"
                          )}>
                            {theme.name}
                          </h4>
                          {theme.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {theme.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {!isUsed && (
                        <div className={cn(
                          "w-6 h-6 rounded-full border shrink-0 flex items-center justify-center transition-all mt-0.5",
                          isActive
                            ? "border-white bg-white"
                            : "border-white/20 group-hover:border-white/40"
                        )}>
                          {isLoading ? (
                            <span className="w-2.5 h-2.5 rounded-full border border-gray-400 border-t-transparent animate-spin" />
                          ) : isActive ? (
                            <Check className="w-3 h-3 text-black" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Theme */}
      {showForm ? (
        <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">New Theme</p>
          <div className="grid grid-cols-[1fr_60px] gap-2">
            <input
              autoFocus
              placeholder="Theme name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
            <input
              placeholder="emoji"
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 text-center"
            />
          </div>
          <input
            placeholder="Category (e.g. Developer Tools)"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
          <textarea
            placeholder="One-liner description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
          />
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddTheme}
              disabled={formSaving}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-50"
            >
              {formSaving ? "Saving…" : "Add Theme"}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/10 text-gray-600 hover:text-white hover:border-white/20 transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Theme
        </button>
      )}
    </div>
  );
}
