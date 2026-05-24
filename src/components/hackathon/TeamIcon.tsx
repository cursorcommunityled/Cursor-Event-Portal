import Image from "next/image";
import { cn } from "@/lib/utils";
import type { EventPhoto } from "@/types";

interface TeamIconProps {
  photo?: Pick<EventPhoto, "file_url" | "status"> | null;
  name?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  sizes?: string;
}

export function TeamIcon({
  photo,
  name,
  className,
  imageClassName,
  fallbackClassName,
  sizes = "56px",
}: TeamIconProps) {
  const hasApprovedPhoto = photo?.status === "approved" && photo.file_url;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]",
        className
      )}
    >
      {hasApprovedPhoto ? (
        <Image
          src={photo.file_url}
          alt={`${name ?? "Team"} icon`}
          fill
          className={cn("object-cover", imageClassName)}
          sizes={sizes}
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-white/[0.03]" />
          <Image
            src="/cursor-logo.svg"
            alt="Cursor logo placeholder"
            fill
            className={cn("object-cover object-left opacity-20 grayscale", fallbackClassName)}
            sizes={sizes}
          />
        </>
      )}
    </div>
  );
}
