"use client";

import { useState, useRef, useEffect } from "react";
import {
  createPlannedEvent,
  updatePlannedEvent,
  deletePlannedEvent,
  createEventCalendarCity,
} from "@/lib/actions/event-dashboard";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, X, MapPin, Clock, StickyNote, CalendarCheck } from "lucide-react";
import type { PlannedEvent, EventCalendarCity } from "@/types";

interface CalendarAdminTabProps {
  initialEvents: PlannedEvent[];
  initialCities: EventCalendarCity[];
}

type EditState = Partial<Omit<PlannedEvent, "id" | "created_at" | "updated_at" | "linked_event_id">>;

function blankFor(city: string): EditState {
  return {
    title: "",
    event_date: "",
    city,
    start_time: null,
    end_time: null,
    venue: null,
    address: null,
    notes: null,
    confirmed: false,
  };
}

function formatTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function groupByMonth(events: PlannedEvent[]) {
  const map = new Map<string, PlannedEvent[]>();
  for (const e of events) {
    const key = e.event_date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

export function CalendarAdminTab({ initialEvents, initialCities }: CalendarAdminTabProps) {
  const [cities, setCities] = useState<EventCalendarCity[]>(initialCities);
  const [activeCity, setActiveCity] = useState<string>(initialCities[0]?.name ?? "Calgary");
  const [events, setEvents] = useState<PlannedEvent[]>(initialEvents);

  // ── Add city inline ───────────────────────────────────────────────────────
  const [addingCity, setAddingCity] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingCity) cityInputRef.current?.focus();
  }, [addingCity]);

  const handleAddCity = async () => {
    if (!newCityName.trim()) return;
    setCityLoading(true);
    setCityError(null);
    const result = await createEventCalendarCity(newCityName.trim());
    if (result.error) {
      setCityError(result.error);
      setCityLoading(false);
      return;
    }
    setCities((prev) => [...prev, result.data as EventCalendarCity]);
    setActiveCity((result.data as EventCalendarCity).name);
    setNewCityName("");
    setAddingCity(false);
    setCityLoading(false);
  };

  // ── Create event ──────────────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState<EditState>(blankFor(activeCity));
  const [loading, setLoading] = useState<string | null>(null);

  // Reset city in form when switching tabs
  const switchCity = (city: string) => {
    setActiveCity(city);
    setCreating(false);
    setNewEvent(blankFor(city));
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newEvent.title?.trim() || !newEvent.event_date) return;
    setLoading("create");
    const result = await createPlannedEvent({
      title: newEvent.title.trim(),
      event_date: newEvent.event_date,
      city: activeCity,
      start_time: newEvent.start_time || null,
      end_time: newEvent.end_time || null,
      venue: newEvent.venue || null,
      address: newEvent.address || null,
      notes: newEvent.notes || null,
      confirmed: newEvent.confirmed ?? false,
    });
    if (!result.error && result.data) {
      setEvents((prev) =>
        [...prev, result.data as PlannedEvent].sort((a, b) =>
          a.event_date.localeCompare(b.event_date)
        )
      );
      setCreating(false);
      setNewEvent(blankFor(activeCity));
    }
    setLoading(null);
  };

  // ── Update event ──────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({});

  const startEdit = (ev: PlannedEvent) => {
    setEditingId(ev.id);
    setEditState({
      title: ev.title,
      event_date: ev.event_date,
      city: ev.city,
      start_time: ev.start_time,
      end_time: ev.end_time,
      venue: ev.venue,
      address: ev.address,
      notes: ev.notes,
      confirmed: ev.confirmed,
    });
  };

  const handleUpdate = async (id: string) => {
    setLoading(id);
    const result = await updatePlannedEvent(id, {
      title: editState.title?.trim() || undefined,
      event_date: editState.event_date || undefined,
      city: editState.city || undefined,
      start_time: editState.start_time ?? null,
      end_time: editState.end_time ?? null,
      venue: editState.venue ?? null,
      address: editState.address ?? null,
      notes: editState.notes ?? null,
      confirmed: editState.confirmed,
    });
    if (!result.error) {
      setEvents((prev) =>
        prev
          .map((e) => e.id === id ? { ...e, ...editState, updated_at: new Date().toISOString() } : e)
          .sort((a, b) => a.event_date.localeCompare(b.event_date))
      );
      setEditingId(null);
    }
    setLoading(null);
  };

  // ── Delete event ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Remove this planned event?")) return;
    setLoading(id + "-del");
    const result = await deletePlannedEvent(id);
    if (!result.error) setEvents((prev) => prev.filter((e) => e.id !== id));
    setLoading(null);
  };

  const cityEvents = events.filter((e) => e.city === activeCity);
  const grouped = groupByMonth(cityEvents);

  return (
    <div className="space-y-6">

      {/* ── City tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {cities.map((city) => {
          const count = events.filter((e) => e.city === city.name).length;
          const isActive = activeCity === city.name;
          return (
            <button
              key={city.id}
              onClick={() => switchCity(city.name)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-white text-black shadow-glow"
                  : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
              )}
            >
              {city.name}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 leading-none",
                  isActive ? "bg-black/20 text-black" : "bg-white/10 text-gray-500"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Add city */}
        {addingCity ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={cityInputRef}
              type="text"
              value={newCityName}
              onChange={(e) => { setNewCityName(e.target.value); setCityError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCity(); if (e.key === "Escape") { setAddingCity(false); setNewCityName(""); setCityError(null); } }}
              placeholder="City name"
              className="bg-white/5 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/40 w-36 transition-colors"
            />
            <button
              onClick={handleAddCity}
              disabled={cityLoading || !newCityName.trim()}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center disabled:opacity-40 hover:bg-white/90 transition-all"
            >
              <Check className="w-3.5 h-3.5 text-black" />
            </button>
            <button
              onClick={() => { setAddingCity(false); setNewCityName(""); setCityError(null); }}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {cityError && (
              <span className="text-xs text-red-400">{cityError}</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAddingCity(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-gray-600 hover:text-white border border-dashed border-white/10 hover:border-white/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add City
          </button>
        )}
      </div>

      {/* ── Add event button ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-medium">
          {activeCity} · {cityEvents.length} event{cityEvents.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => { setCreating(true); setNewEvent(blankFor(activeCity)); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white hover:bg-white/15 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {/* ── Create form ──────────────────────────────────────────────────────── */}
      {creating && (
        <div className="glass rounded-3xl p-6 border-white/20 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-medium">
            New Event · {activeCity}
          </p>
          <EventForm
            state={newEvent}
            cities={cities.map((c) => c.name)}
            onChange={(k, v) => setNewEvent((s) => ({ ...s, [k]: v }))}
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={loading === "create" || !newEvent.title || !newEvent.event_date}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black text-sm font-medium disabled:opacity-40 hover:bg-white/90 transition-all"
            >
              <Check className="w-4 h-4" />
              {loading === "create" ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setCreating(false); setNewEvent(blankFor(activeCity)); }}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Events grouped by month ──────────────────────────────────────────── */}
      {grouped.size === 0 && !creating && (
        <div className="glass rounded-3xl p-10 border-white/10 text-center">
          <CalendarCheck className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No events planned for {activeCity} yet</p>
          <p className="text-xs text-gray-700 mt-1">
            Add one above or bulk-import via SQL
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([monthKey, monthEvents]) => (
        <div key={monthKey}>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium mb-4">
            {monthLabel(monthKey)}
          </p>
          <div className="space-y-2">
            {monthEvents.map((ev) => {
              const isEditing = editingId === ev.id;
              const isDeleting = loading === ev.id + "-del";
              const isSaving = loading === ev.id;
              const isPast = ev.event_date < new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={ev.id}
                  className={cn(
                    "glass rounded-2xl border transition-all",
                    isEditing
                      ? "border-white/30 bg-white/5 p-5"
                      : isPast
                      ? "border-white/5 p-4 opacity-50"
                      : ev.confirmed
                      ? "border-white/20 p-4 hover:border-white/30"
                      : "border-dashed border-white/10 p-4 hover:border-white/20"
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <EventForm
                        state={editState}
                        cities={cities.map((c) => c.name)}
                        onChange={(k, v) => setEditState((s) => ({ ...s, [k]: v }))}
                      />
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => handleUpdate(ev.id)}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black text-sm font-medium disabled:opacity-40 hover:bg-white/90 transition-all"
                        >
                          <Check className="w-4 h-4" />
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
                        >
                          <X className="w-4 h-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        {/* Date block */}
                        <div className="shrink-0 text-center min-w-[44px]">
                          <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium leading-none">
                            {new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-CA", { month: "short" })}
                          </p>
                          <p className="text-2xl font-light text-white/80 leading-tight">
                            {String(Number(ev.event_date.slice(8))).padStart(2, "0")}
                          </p>
                        </div>

                        {/* Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-white/90 text-sm">{ev.title}</h4>
                            {ev.confirmed ? (
                              <span className="text-[9px] uppercase tracking-widest text-green-400/70 font-medium">Confirmed</span>
                            ) : (
                              <span className="text-[9px] uppercase tracking-widest text-gray-600 font-medium">Tentative</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            {ev.venue && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="w-3 h-3" /> {ev.venue}
                              </span>
                            )}
                            {(ev.start_time || ev.end_time) && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {formatTime(ev.start_time)}
                                {ev.end_time && ` – ${formatTime(ev.end_time)}`}
                              </span>
                            )}
                            {ev.notes && (
                              <span className="flex items-center gap-1 text-xs text-gray-600 italic">
                                <StickyNote className="w-3 h-3" /> {ev.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(ev)}
                          className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors font-medium px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          disabled={isDeleting}
                          className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all text-gray-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-700 text-center font-medium pt-2">
        Bulk import from spreadsheet · SQL INSERT into planned_events with city column
      </p>
    </div>
  );
}

// ─── Shared form ──────────────────────────────────────────────────────────────

function EventForm({
  state,
  cities,
  onChange,
}: {
  state: EditState;
  cities: string[];
  onChange: (key: keyof EditState, value: string | boolean | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input
        type="text"
        placeholder="Event title *"
        value={state.title ?? ""}
        onChange={(e) => onChange("title", e.target.value)}
        className="col-span-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors"
      />

      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-600 font-medium block mb-1">Date *</label>
        <input
          type="date"
          value={state.event_date ?? ""}
          onChange={(e) => onChange("event_date", e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-600 font-medium block mb-1">City</label>
        <select
          value={state.city ?? ""}
          onChange={(e) => onChange("city", e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors appearance-none"
        >
          {cities.map((c) => (
            <option key={c} value={c} className="bg-black">{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-600 font-medium block mb-1">Venue</label>
        <input
          type="text"
          placeholder="e.g. Platform Calgary"
          value={state.venue ?? ""}
          onChange={(e) => onChange("venue", e.target.value || null)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-600 font-medium block mb-1">Start Time</label>
        <input
          type="time"
          value={state.start_time ?? ""}
          onChange={(e) => onChange("start_time", e.target.value || null)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-600 font-medium block mb-1">End Time</label>
        <input
          type="time"
          value={state.end_time ?? ""}
          onChange={(e) => onChange("end_time", e.target.value || null)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      <input
        type="text"
        placeholder="Address (optional)"
        value={state.address ?? ""}
        onChange={(e) => onChange("address", e.target.value || null)}
        className="col-span-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors"
      />

      <input
        type="text"
        placeholder="Notes (optional)"
        value={state.notes ?? ""}
        onChange={(e) => onChange("notes", e.target.value || null)}
        className="col-span-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors"
      />

      <label className="flex items-center gap-3 cursor-pointer col-span-full">
        <div
          onClick={() => onChange("confirmed", !state.confirmed)}
          className={cn(
            "w-9 h-5 rounded-full border transition-all relative",
            state.confirmed ? "bg-white border-white" : "bg-white/5 border-white/20"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full transition-all",
            state.confirmed ? "left-4 bg-black" : "left-0.5 bg-gray-600"
          )} />
        </div>
        <span className="text-sm text-gray-400">Confirmed</span>
      </label>
    </div>
  );
}
