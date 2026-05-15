"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import Image from "next/image";
import { uploadSlide, deleteSlide, updateSlide, reorderSlides, toggleSlideLive } from "@/lib/actions/slides";
import type { Event, Slide } from "@/types";
import { ArrowLeft, Plus, Trash2, Edit2, GripVertical, Upload, X, Eye, EyeOff, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

interface SlidesAdminClientProps {
  event: Event;
  eventSlug: string;
  initialSlides: Slide[];
}

export function SlidesAdminClient({
  event,
  eventSlug,
  initialSlides,
}: SlidesAdminClientProps) {
  const router = useRouter();
  const [slides, setSlides] = useState(initialSlides);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // Configure PDF.js worker
  const configurePdfWorker = () => {
    if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // Use jsdelivr CDN which is more reliable
      // For pdfjs-dist 5.x, use .mjs extension
      const version = pdfjsLib.version || "5.4.530";
      // Try the .mjs version first (for v5+), fallback to .js if needed
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }
  };

  // Extract slides from PDF using client-side rendering
  const extractPdfSlides = async (file: File): Promise<Blob[]> => {
    try {
      configurePdfWorker();
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const blobs: Blob[] = [];

    for (let i = 1; i <= numPages; i++) {
      setUploadProgress(`Processing page ${i} of ${numPages}...`);
      
      const page = await pdf.getPage(i);
      const scale = 2; // Higher scale for better quality
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise;

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to convert page to image"));
          },
          "image/png",
          0.95
        );
      });

      blobs.push(blob);
    }

    return blobs;
    } catch (err: any) {
      // Catch PDF.js specific errors
      if (err?.message?.includes("worker") || err?.message?.includes("Failed to fetch")) {
        throw new Error("Failed to load PDF processor. Please try refreshing the page or use image files instead.");
      }
      throw err;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setUploadProgress("Starting...");

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isPpt = fileName.endsWith(".ppt") || fileName.endsWith(".pptx") || fileName.endsWith(".ppsx");

    try {
      if (isPpt) {
        // PPT files need to be converted to PDF first
        setError("PowerPoint files must be saved as PDF first. In PowerPoint: File → Save As → PDF");
        setUploading(false);
        return;
      }

      if (isPdf) {
        // Process PDF client-side
        setUploadProgress("Loading PDF...");
        const pageBlobs = await extractPdfSlides(file);
        
        if (pageBlobs.length === 0) {
          throw new Error("No pages found in PDF");
        }

        setUploadProgress(`Uploading ${pageBlobs.length} slides...`);

        // Upload each page as a slide
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < pageBlobs.length; i++) {
          setUploadProgress(`Uploading slide ${i + 1} of ${pageBlobs.length}...`);
          
          const formData = new FormData();
          formData.append("file", pageBlobs[i], `slide-${i + 1}.png`);
          formData.append("eventId", event.id);

          try {
            const uploadResponse = await fetch("/api/admin/upload-slide", {
              method: "POST",
              body: formData,
            });

            if (uploadResponse.ok) {
              let slides;
              try {
                const responseData = await uploadResponse.json();
                slides = responseData.slides;
              } catch (jsonError) {
                console.error(`[SlidesAdminClient] Invalid JSON response for slide ${i + 1}:`, jsonError);
                errorCount++;
                continue;
              }
              
              if (slides && slides.length > 0) {
                const result = await uploadSlide(
                  event.id,
                  eventSlug,
                  slides[0].url,
                  `Slide ${i + 1}`
                );
                if (result.success) {
                  successCount++;
                } else {
                  console.error(`[SlidesAdminClient] Failed to save slide ${i + 1}:`, result.error);
                  errorCount++;
                }
              } else {
                console.error(`[SlidesAdminClient] No slides returned for page ${i + 1}`);
                errorCount++;
              }
            } else {
              // Handle server errors gracefully
              let errorMessage = `Upload failed for slide ${i + 1}`;
              try {
                const errorData = await uploadResponse.json().catch(() => ({}));
                errorMessage = errorData.error || errorMessage;
                console.error(`[SlidesAdminClient] Upload failed for slide ${i + 1}:`, errorMessage);
              } catch {
                // If JSON parsing fails, use status-based error message
                if (uploadResponse.status === 502 || uploadResponse.status === 503) {
                  errorMessage = "Server is temporarily unavailable. Please try again in a moment.";
                } else if (uploadResponse.status >= 500) {
                  errorMessage = "Server error. Please try again later.";
                } else {
                  errorMessage = `Upload failed (${uploadResponse.status}). Please try again.`;
                }
                console.error(`[SlidesAdminClient] Upload failed for slide ${i + 1}:`, errorMessage);
              }
              errorCount++;
              // If first slide fails, show immediate error
              if (i === 0) {
                setError(errorMessage);
              }
            }
          } catch (fetchError) {
            console.error(`[SlidesAdminClient] Network error uploading slide ${i + 1}:`, fetchError);
            errorCount++;
          }
        }

        if (errorCount > 0) {
          setError(`Uploaded ${successCount} of ${pageBlobs.length} slides. ${errorCount} failed.`);
        } else {
          router.refresh();
          setShowUploadModal(false);
        }
      } else {
        // Regular image upload
        setUploadProgress("Uploading image...");
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("eventId", event.id);

        const uploadResponse = await fetch("/api/admin/upload-slide", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          // Handle server errors (502, 503, 500, etc.)
          let errorMessage = "Failed to upload slide";
          try {
            const errorData = await uploadResponse.json().catch(() => ({}));
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use status-based error message
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

        let slides;
        try {
          const responseData = await uploadResponse.json();
          slides = responseData.slides;
        } catch (jsonError) {
          throw new Error("Server returned invalid response. Please try again.");
        }

        if (!slides || slides.length === 0) {
          throw new Error("Failed to process the image");
        }

        const result = await uploadSlide(
          event.id,
          eventSlug,
          slides[0].url,
          file.name.replace(/\.[^/.]+$/, "") // Use filename without extension as title
        );

        if (result.success) {
          router.refresh();
          setShowUploadModal(false);
        } else {
          throw new Error(result.error || "Failed to save slide");
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload";
      setError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleDelete = async (slideId: string) => {
    if (!confirm("Are you sure you want to delete this slide?")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteSlide(slideId, eventSlug);
      if (result.success) {
        setSlides((prev) => prev.filter((s) => s.id !== slideId));
        router.refresh();
      } else {
        setError(result.error || "Failed to delete slide");
      }
    });
  };

  const handleUpdate = async (slideId: string, data: { title?: string }) => {
    setError(null);
    startTransition(async () => {
      const result = await updateSlide(slideId, eventSlug, data);
      if (result.success) {
        router.refresh();
        setEditingSlide(null);
      } else {
        setError(result.error || "Failed to update slide");
      }
    });
  };

  const handleReorder = async (newOrder: Slide[]) => {
    const slideIds = newOrder.map((s) => s.id);
    setSlides(newOrder);
    
    startTransition(async () => {
      await reorderSlides(eventSlug, slideIds);
      router.refresh();
    });
  };

  const handleToggleLive = async (slideId: string, isLive: boolean) => {
    setError(null);
    
    // Optimistic update
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        is_live: s.id === slideId ? isLive : false, // Turn off others when enabling
      }))
    );

    startTransition(async () => {
      const result = await toggleSlideLive(slideId, eventSlug, isLive);
      if (result.error) {
        setError(result.error);
        router.refresh(); // Revert on error
      } else {
        router.refresh();
      }
    });
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    const newSlides = [...slides];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newSlides.length) return;

    [newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]];
    handleReorder(newSlides);
  };

  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <AdminHeader 
        eventSlug={eventSlug} 
        subtitle="Slides Management"
        rightElement={
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all shadow-xl"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12 animate-fade-in">
        {/* Error Message */}
        {error && (
          <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="glass rounded-[32px] p-6 bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-400">
            Upload <span className="text-blue-300 font-medium">PDF files</span> or individual images (PNG, JPG). Each PDF page becomes a slide. <span className="text-blue-300">For PowerPoint: Save As → PDF</span>. Slides display to attendees when marked "Live" (eye icon).
          </p>
        </div>

        {/* Slides Grid */}
        {slides.length === 0 ? (
          <div
            onClick={() => setShowUploadModal(true)}
            className="text-center py-24 glass rounded-[40px] border-dashed border-white/10 cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all group"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-600 group-hover:text-white transition-colors" />
            <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600 group-hover:text-white transition-colors">
              No slides yet
            </p>
            <p className="text-[9px] text-gray-800 group-hover:text-gray-400 mt-2 transition-colors">
              Click here or the + button to upload your first slide
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className="glass rounded-[32px] p-6 border-white/[0.03] hover:bg-white/[0.01] transition-all relative group"
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-white/5 mb-4">
                  <Image
                    src={slide.image_url}
                    alt={slide.title || `Slide ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {slide.title ? (
                      <p className="text-sm font-light text-white/90 truncate">{slide.title}</p>
                    ) : (
                      <p className="text-xs text-gray-600">Slide {index + 1}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[9px] text-gray-700">
                        Position {index + 1} of {slides.length}
                      </p>
                      {slide.is_live && (
                        <span className="text-[9px] uppercase tracking-wider text-green-400 font-medium flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleLive(slide.id, !slide.is_live)}
                      disabled={isPending}
                      className={cn(
                        "w-8 h-8 rounded-lg border transition-all flex items-center justify-center",
                        slide.is_live
                          ? "bg-green-500/20 border-green-500/30 text-green-400"
                          : "bg-white/[0.02] border-white/5 text-gray-600 hover:text-white hover:border-white/20"
                      )}
                      title={slide.is_live ? "Hide from attendees" : "Show to attendees"}
                    >
                      {slide.is_live ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => moveSlide(index, "up")}
                      disabled={index === 0 || isPending}
                      className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white hover:border-white/20 transition-all flex items-center justify-center disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveSlide(index, "down")}
                      disabled={index === slides.length - 1 || isPending}
                      className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white hover:border-white/20 transition-all flex items-center justify-center disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditingSlide(slide)}
                      disabled={isPending}
                      className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white hover:border-white/20 transition-all flex items-center justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(slide.id)}
                      disabled={isPending}
                      className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 text-gray-800 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Slides</p>
        </div>
      </footer>

      {/* Upload Modal */}
      {showUploadModal && (
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
              <h2 className="text-2xl font-light text-white">Upload Slide</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
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
                  Select Slide Deck or Image
                </label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                    id="slide-upload"
                  />
                  <label
                    htmlFor="slide-upload"
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
                          {uploadProgress || "Processing..."}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-2">
                          Please wait while slides are being extracted
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-3">
                          <FileText className="w-7 h-7 text-red-400" />
                          <Upload className="w-7 h-7 text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-400">
                          Click to select PDF or image
                        </p>
                        <p className="text-[9px] text-gray-600 mt-1">
                          <span className="text-red-400 font-medium">PDF</span> (all pages become slides) or PNG, JPG
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
      )}

      {/* Edit Modal */}
      {editingSlide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingSlide(null)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass rounded-[40px] p-10 space-y-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-light text-white">Edit Slide</h2>
              <button
                onClick={() => setEditingSlide(null)}
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const title = formData.get("title") as string;
                handleUpdate(editingSlide.id, { title: title.trim() || undefined });
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                  Title (optional)
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingSlide.title || ""}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
                  placeholder="e.g., Welcome Slide"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 h-14 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                >
                  {isPending ? "..." : "Update"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSlide(null)}
                  disabled={isPending}
                  className="px-8 h-14 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 disabled:opacity-30 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

