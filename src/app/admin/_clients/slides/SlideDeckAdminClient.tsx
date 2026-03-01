"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { removeSlideDeck, toggleSlideDeckLive, toggleSlideDeckPopup, updateSlideCurrentPage } from "@/lib/actions/slideDecks";
import { PdfDeckViewer } from "@/components/slides/PdfDeckViewer";
import { getSlideDeck } from "@/lib/supabase/queries";
import type { Event, SlideDeck } from "@/types";
import { ArrowLeft, Upload, X, Trash2, FileText, Loader2, Eye, EyeOff, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideDeckAdminClientProps {
  event: Event;
  eventSlug: string;
  adminCode?: string;
  initialDeck: SlideDeck | null;
  embedded?: boolean;
}

export function SlideDeckAdminClient({
  event,
  eventSlug,
  adminCode,
  initialDeck,
  embedded,
}: SlideDeckAdminClientProps) {
  const router = useRouter();
  const [deck, setDeck] = useState<SlideDeck | null>(initialDeck);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setUploadProgress("Uploading slide deck...");

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isPpt = fileName.endsWith(".ppt") || fileName.endsWith(".pptx") || fileName.endsWith(".ppsx");

    try {
      if (isPpt) {
        setError("PowerPoint files must be saved as PDF first. In PowerPoint: File → Save As → PDF");
        setUploading(false);
        return;
      }

      if (!isPdf) {
        setError("Only PDF files are supported for slide decks");
        setUploading(false);
        return;
      }

      const maxSize = 100 * 1024 * 1024; // 100MB (must match server limit)
      if (file.size > maxSize) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setError(`This PDF is ${sizeMb}MB. The limit is 100MB.`);
        setUploading(false);
        return;
      }

      // Read file into memory first to avoid ERR_UPLOAD_FILE_CHANGED errors
      // This happens when antivirus, OneDrive, or Windows indexing touches the file
      setUploadProgress("Reading file...");
      let memoryFile: File = file;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        memoryFile = new File([blob], file.name, { type: "application/pdf" });
      } catch (readError) {
        console.error("Failed to read file:", readError);
        const readMessage =
          readError instanceof Error ? readError.message : String(readError ?? "");
        const isNotFoundLike =
          readMessage.toLowerCase().includes("requested file or directory could not be found") ||
          readMessage.toLowerCase().includes("notfounderror") ||
          readMessage.toLowerCase().includes("not found");

        if (isNotFoundLike) {
          // Fall back to uploading the original file directly.
          setUploadProgress("Uploading slide deck...");
        } else {
          setError(
            `Could not read file "${file.name}". The file may be locked, corrupted, or temporarily inaccessible. Try closing any programs that have it open.`
          );
          setUploading(false);
          return;
        }
      }

      setUploadProgress("Uploading slide deck...");
      const formData = new FormData();
      formData.append("file", memoryFile);
      formData.append("eventId", event.id);

      const uploadResponse = await fetch("/api/admin/upload-deck", {
        method: "POST",
        body: formData,
        headers: adminCode ? {
          "x-admin-code": adminCode,
          "x-event-id": event.id,
        } : {},
      });

      if (!uploadResponse.ok) {
        let errorMessage = "Failed to upload slide deck";
        try {
          const errorData = await uploadResponse.json().catch(() => ({}));
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (uploadResponse.status === 502 || uploadResponse.status === 503) {
            errorMessage = "Server is temporarily unavailable. Please try again in a moment.";
          } else if (uploadResponse.status >= 500) {
            errorMessage = "Server error. Please try again later.";
          } else {
            errorMessage = `Upload failed (${uploadResponse.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await uploadResponse.json();
      if (responseData.success && responseData.deck) {
        setDeck(responseData.deck);
        router.refresh();
        setShowUploadModal(false);
      } else {
        throw new Error("Failed to save slide deck");
      }

      if (e.target) {
        e.target.value = "";
      }
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : "Failed to upload slide deck";

      // Handle common network/file errors with clearer messages
      if (errorMessage.toLowerCase().includes("failed to fetch") ||
          errorMessage.toLowerCase().includes("network") ||
          errorMessage.toLowerCase().includes("file changed")) {
        errorMessage = "Upload failed. If the file is in OneDrive or a synced folder, try copying it to your Desktop first and uploading from there.";
      }

      setError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleDelete = async () => {
    if (!deck) return;
    
    if (!confirm("Are you sure you want to delete this slide deck? This cannot be undone.")) return;

    setError(null);
    startTransition(async () => {
      const result = await removeSlideDeck(event.id, eventSlug, adminCode);
      if (result.success) {
        setDeck(null);
        router.refresh();
      } else {
        setError(result.error || "Failed to delete slide deck");
      }
    });
  };

  const handleToggleLive = async (isLive: boolean) => {
    if (!deck) return;

    // Prevent disabling slides page if popup is enabled
    if (!isLive && deck.popup_visible) {
      setError("Cannot disable slides page when right-center popup is enabled. Please disable the popup first.");
      return;
    }

    setError(null);
    
    // Optimistic update
    setDeck((prev) => prev ? { ...prev, is_live: isLive } : null);

    startTransition(async () => {
      const result = await toggleSlideDeckLive(event.id, eventSlug, isLive, adminCode);
      if (result.error) {
        setError(result.error);
        router.refresh(); // Revert on error
      } else {
        router.refresh();
      }
    });
  };

  const handleTogglePopup = async (popupVisible: boolean) => {
    if (!deck) return;

    setError(null);
    
    // If enabling popup, also enable slides page if it's not already enabled
    if (popupVisible && !deck.is_live) {
      // Enable both popup and slides page
      setDeck((prev) => prev ? { ...prev, popup_visible: true, is_live: true } : null);
      
      startTransition(async () => {
        // Enable slides page first, then popup
        const liveResult = await toggleSlideDeckLive(event.id, eventSlug, true, adminCode);
        if (liveResult.error) {
          setError(liveResult.error);
          router.refresh();
          return;
        }
        
        const popupResult = await toggleSlideDeckPopup(event.id, eventSlug, true, adminCode);
        if (popupResult.error) {
          setError(popupResult.error);
          router.refresh();
        } else {
          router.refresh();
        }
      });
      return;
    }
    
    // Optimistic update for disabling popup (no restrictions)
    setDeck((prev) => prev ? { ...prev, popup_visible: popupVisible } : null);

    startTransition(async () => {
      const result = await toggleSlideDeckPopup(event.id, eventSlug, popupVisible, adminCode);
      if (result.error) {
        setError(result.error);
        router.refresh(); // Revert on error
      } else {
        router.refresh();
      }
    });
  };

  const mainContent = (
    <div className="space-y-12 animate-fade-in">
        {/* Error Message */}
        {error && (
          <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="glass rounded-[32px] p-6 bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-400">
            Upload a <span className="text-blue-300 font-medium">PDF slide deck</span> for this event. The entire PDF will be displayed to attendees. <span className="text-blue-300">For PowerPoint: Save As → PDF</span>.
          </p>
        </div>

        {/* Slide Deck Display */}
        {!deck ? (
          <div
            onClick={() => setShowUploadModal(true)}
            className="text-center py-24 glass rounded-[40px] border-dashed border-white/10 cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all group"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-600 group-hover:text-white transition-colors" />
            <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600 group-hover:text-white transition-colors">
              No slide deck uploaded
            </p>
            <p className="text-[9px] text-gray-800 group-hover:text-gray-400 mt-2 transition-colors">
              Click here or the + button to upload your slide deck (PDF)
            </p>
          </div>
        ) : (
          <div className="glass rounded-[32px] p-6 border-white/[0.03] hover:bg-white/[0.01] transition-all relative group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-red-400" />
                  <div>
                    <p className="text-sm font-light text-white/90">Slide Deck</p>
                    <div className="flex items-center gap-2 mt-1">
                      {deck.page_count && (
                        <p className="text-[9px] text-gray-600">
                          {deck.page_count} {deck.page_count === 1 ? "page" : "pages"}
                        </p>
                      )}
                      {deck.is_live && (
                        <span className="text-[9px] uppercase tracking-wider text-green-400 font-medium flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Live
                        </span>
                      )}
                      {deck.popup_visible && (
                        <span className="text-[9px] uppercase tracking-wider text-blue-400 font-medium flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Popup
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[9px] text-gray-700 mt-2">
                  Uploaded {new Date(deck.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleLive(!deck.is_live)}
                  disabled={isPending || (!deck.is_live && deck.popup_visible)}
                  className={cn(
                    "w-10 h-10 rounded-lg border transition-all flex items-center justify-center",
                    deck.is_live
                      ? "bg-green-500/20 border-green-500/30 text-green-400"
                      : "bg-white/[0.02] border-white/5 text-gray-600 hover:text-white hover:border-white/20",
                    !deck.is_live && deck.popup_visible && "opacity-50 cursor-not-allowed"
                  )}
                  title={
                    !deck.is_live && deck.popup_visible
                      ? "Cannot disable slides page when popup is enabled"
                      : deck.is_live
                      ? "Hide from attendees tab"
                      : "Show in attendees tab"
                  }
                >
                  {deck.is_live ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleTogglePopup(!deck.popup_visible)}
                  disabled={isPending}
                  className={cn(
                    "w-10 h-10 rounded-lg border transition-all flex items-center justify-center",
                    deck.popup_visible
                      ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                      : "bg-white/[0.02] border-white/5 text-gray-600 hover:text-white hover:border-white/20"
                  )}
                  title={deck.popup_visible ? "Hide right-center popup" : "Show right-center popup"}
                >
                  <PanelRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="w-10 h-10 rounded-lg bg-white/[0.02] border border-white/5 text-gray-800 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center disabled:opacity-30"
                  title="Delete slide deck"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Live Control</p>
                <p className="text-[9px] text-blue-400">
                  Attendees see what you see
                </p>
              </div>
              <div className="aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/5">
                <PdfDeckViewer
                  pdfUrl={deck.pdf_url}
                  className="w-full h-full"
                  showControls={true}
                  initialPage={deck.current_page || 1}
                  onPageChange={(page) => {
                    updateSlideCurrentPage(event.id, page, adminCode);
                  }}
                />
              </div>
              <p className="text-[9px] text-gray-600 mt-2 text-center">
                Use arrows to navigate • Changes sync to all attendees in real-time
              </p>
            </div>
          </div>
        )}
    </div>
  );

  const uploadModal = showUploadModal ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => !uploading && setShowUploadModal(false)}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-[40px] p-10 space-y-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light text-white">Upload Slide Deck</h2>
          <button
            onClick={() => setShowUploadModal(false)}
            disabled={uploading}
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-3">
              Select PDF Slide Deck
            </label>
            <div className="relative">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
                id="deck-upload"
              />
              <label
                htmlFor="deck-upload"
                className={cn(
                  "flex flex-col items-center justify-center w-full h-56 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
                  uploading
                    ? "border-white/10 bg-white/5 cursor-not-allowed"
                    : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 mb-3 text-blue-400 animate-spin" />
                    <p className="text-sm text-blue-400 font-medium">
                      {uploadProgress || "Uploading..."}
                    </p>
                    <p className="text-[9px] text-gray-600 mt-2">
                      Please wait while your slide deck is being uploaded
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-7 h-7 text-red-400" />
                      <Upload className="w-7 h-7 text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-400">Click to select PDF file</p>
                    <p className="text-[9px] text-gray-600 mt-1">
                      <span className="text-red-400 font-medium">PDF</span> slide deck only
                    </p>
                    <p className="text-[8px] text-gray-700 mt-3 text-center max-w-xs">
                      For PowerPoint: File → Save As → PDF
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (embedded) {
    return (
      <>
        {mainContent}
        {uploadModal}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <AdminHeader
        eventSlug={eventSlug}
        adminCode={adminCode}
        subtitle="Slide Deck Management"
        rightElement={
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={isPending}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
          </button>
        }
      />
      <main className="max-w-4xl mx-auto px-6 py-12">
        {mainContent}
      </main>
      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Slide Deck</p>
      </footer>
      {uploadModal}
    </div>
  );
}
