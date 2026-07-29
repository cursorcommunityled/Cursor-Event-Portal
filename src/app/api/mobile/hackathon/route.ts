import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import {
  sendTeamInvite,
  acceptTeamInvite,
  declineTeamInvite,
  createSoloTeam,
  startSoloHackathonTeam,
  renameTeam,
  leaveTeam,
  dissolveTeam,
  submitHackathonProject,
  cancelHackathonProjectSubmission,
  cancelTeamInvite,
  volunteerTeamToPresent,
} from "@/lib/actions/hackathon";
import { updateMyHackathonProfile } from "@/lib/actions/hackathon-profiles";
import {
  sendChatMessage,
  toggleChatReaction,
  markChannelRead,
  editChatMessage,
  deleteChatMessage,
} from "@/lib/actions/hackathon-chat";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    const body = await request.json();
    const { action } = body as { action?: string };

    switch (action) {
      case "invite": {
        const result = await sendTeamInvite(
          body.eventId,
          body.invitedUserId,
          body.teamName
        );
        return NextResponse.json(result);
      }
      case "accept-invite":
        return NextResponse.json(await acceptTeamInvite(body.inviteId));
      case "decline-invite":
        return NextResponse.json(await declineTeamInvite(body.inviteId));
      case "cancel-invite":
        return NextResponse.json(
          await cancelTeamInvite(body.eventId, body.invitedUserId)
        );
      case "create-solo":
        return NextResponse.json(
          await createSoloTeam(body.eventId, body.teamName)
        );
      case "start-solo":
        return NextResponse.json(await startSoloHackathonTeam(body.eventId));
      case "rename-team":
        return NextResponse.json(
          await renameTeam(body.teamId, body.eventId, body.name)
        );
      case "leave-team":
        return NextResponse.json(await leaveTeam(body.teamId));
      case "dissolve-team":
        return NextResponse.json(await dissolveTeam(body.teamId));
      case "submit-project":
        return NextResponse.json(
          await submitHackathonProject(body.teamId, body.eventId, body.data)
        );
      case "cancel-project":
        return NextResponse.json(
          await cancelHackathonProjectSubmission(body.teamId, body.eventId)
        );
      case "volunteer-present":
        return NextResponse.json(
          await volunteerTeamToPresent(body.teamId, body.eventId)
        );
      case "update-profile":
        return NextResponse.json(
          await updateMyHackathonProfile(body.eventId, body.data)
        );
      case "chat-send":
        return NextResponse.json(
          await sendChatMessage(
            body.channelId,
            body.eventId,
            body.content,
            body.mentionedUserIds ?? [],
            body.fileUrl,
            body.fileType,
            body.fileName,
            body.fileSizeBytes
          )
        );
      case "chat-react":
        return NextResponse.json(
          await toggleChatReaction(body.messageId, body.emoji)
        );
      case "chat-read":
        await markChannelRead(body.channelId);
        return NextResponse.json({ success: true });
      case "chat-edit":
        return NextResponse.json(
          await editChatMessage(body.messageId, body.content)
        );
      case "chat-delete":
        return NextResponse.json(await deleteChatMessage(body.messageId));
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}`, sessionUser: session.userId },
          { status: 400 }
        );
    }
  });
}
