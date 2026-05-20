import type { HackathonChatMessage } from "@/types";

export type LocalHackathonChatMessage = HackathonChatMessage & {
  upload_status?: "uploading" | "posting";
};