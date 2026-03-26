"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Loader2, Trash2 } from "lucide-react";
import { updateEntry, removeEntryMedia, deleteEntry } from "@/lib/actions/competitions";
import type { CompetitionEntry } from "@/types";

interface EditEntryModalProps {
  entry: CompetitionEntry;
  competitionId: string;
  eventId: string;
  eventSlug: string;
  onClose: () => void;
}

export function EditEntryModal({
  entry,
  competitionId,
  eventId,
  eventSlug,
  onClose,
}: EditEntryModalProps) {
  const [title, setTitle] = useState(entry.title);
  const [description, setDescription] = useState(entry.description || "");
  const [repoUrl, setRepoUrl] = useState(entry.repo_url);
  const [projectUrl, setProjectUrl] = useState(entry.project_url || "");
  const [previewImageUrl, setPreviewImageUrl] = useState(entry.preview_image_url || "");
  const [videoUrl, setVideoUrl] = useState(entry.video_url || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter a project title");
      return;
    }
    if (!repoUrl.trim()) {
      setError("Please enter a GitHub URL");
      return;
    }

    setLoading(true);
    const result = await updateEntry(entry.id, eventSlug, {
      title: title.trim(),
      description: description.trim() || undefined,
      repo_url: repoUrl.trim(),
      project_url: projectUrl.trim() || undefined,
      preview_image_url: previewImageUrl.trim() || null,
      video_url: videoUrl.trim() || null,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => onClose(), 600);
    }
  };

  const handleRemoveImage = async () => {
    setError(null);
    setLoading(true);
    const result = await removeEntryMedia(entry.id, eventSlug, "preview_image");
    if (result.error) {
      setError(result.error);
    } else {
      setPreviewImageUrl("");
    }
    setLoading(false);
  };

  const handleRemoveVideo = async () => {
    setError(null);
    setLoading(true);
    const result = await removeEntryMedia(entry.id, eventSlug, "video");
    if (result.error) {
      setError(result.error);
    } else {
      setVideoUrl("");
    }
    setLoading(false);
  };

  const handleDeleteEntry = async () => {
    if (!confirm("Delete your entry? This cannot be undone.")) return;
    setError(null);
    setLoading(true);
    const result = await deleteEntry(entry.id, eventSlug);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  };

  const handlePreviewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("eventId", eventId);
      form.set("competitionId", competitionId);
      const res = await fetch("/api/competition-upload-preview", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setPreviewImageUrl(data.url);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("Upload timed out. Try a smaller image or paste a URL instead.");
      } else {
        setError("Upload failed. Try pasting an image URL instead.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingVideo(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("eventId", eventId);
      form.set("competitionId", competitionId);
      const res = await fetch("/api/competition-upload-video", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Video upload failed");
        return;
      }
      setVideoUrl(data.url);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("Upload timed out. Try a shorter video or paste a YouTube/Vimeo URL instead.");
      } else {
        setError("Video upload failed. Try pasting a YouTube or Vimeo URL instead.");
      }
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto min-h-screen">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="glass rounded-[32px] border border-white/10 w-full max-w-2xl min-w-0 max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative z-10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] my-8 mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-8 min-w-0 sticky top-0 z-20 -mx-6 sm:-mx-8 px-6 sm:px-8 pt-6 sm:pt-8 pb-4 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 -mt-6 sm:-mt-8 rounded-t-[32px] shrink-0">
          <h2 className="text-xl font-light text-white">Edit Entry</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
            Entry updated successfully!
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 min-w-0 pt-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                Project Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Project"
                disabled={loading}
                className="w-full min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all box-border"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your project..."
                disabled={loading}
                rows={3}
                className="w-full min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all resize-none box-border"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                GitHub URL
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                disabled={loading}
                className="w-full min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all box-border"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                Project URL (optional)
              </label>
              <input
                type="url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://your-project-demo.com"
                disabled={loading}
                className="w-full min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all box-border"
              />
            </div>

            {/* Preview Image */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                Preview image
              </label>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handlePreviewFile}
                    disabled={loading || uploading}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || uploading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploading ? "Uploading…" : previewImageUrl ? "Replace Image" : "Upload Image"}
                  </button>
                  {previewImageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                  <span className="text-[10px] text-gray-500">or paste URL below</span>
                </div>
                <input
                  type="url"
                  value={previewImageUrl}
                  onChange={(e) => setPreviewImageUrl(e.target.value)}
                  placeholder="https://imgur.com/... or direct image link"
                  disabled={loading}
                  className="w-full min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all box-border"
                />
                {previewImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-video max-h-32 w-full">
                    <img
                      src={previewImageUrl}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Video */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                Demo Video (optional)
              </label>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    onChange={handleVideoFile}
                    disabled={loading || uploadingVideo}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={loading || uploadingVideo}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50"
                  >
                    {uploadingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingVideo ? "Uploading…" : videoUrl ? "Replace Video" : "Upload Video"}
                  </button>
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveVideo}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                  <span className="text-[10px] text-gray-500">or paste YouTube / Vimeo URL below</span>
                </div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or Vimeo link"
                  disabled={loading || uploadingVideo}
                  className="w-full min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all box-border"
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                Max 50MB · MP4, WebM, or MOV · Max ~30 seconds recommended
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleDeleteEntry}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Entry
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
