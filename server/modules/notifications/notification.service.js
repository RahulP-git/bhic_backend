import { createNotificationIfMissing } from "../../models/notifications.model.js";
import { listMembers } from "../../models/group-members.model.js";
import { createWhatsAppMessageIfMissing } from "../../models/whatsapp-messages.model.js";
import { sendManagerPushNotification } from "./push.service.js";

export const notifyManagerAndQueueMemberWhatsApp = async ({
  managerUserId,
  groupId,
  cycleId,
  type,
  title,
  body,
  templateId,
  content,
  dedupeKey,
  createdBy,
}) => {
  const createdAt = new Date();
  const notificationResult = await createNotificationIfMissing({
    recipientUserId: managerUserId,
    groupId,
    cycleId,
    type,
    title,
    body,
    dedupeKey,
    createdAt,
  });
  const notification = notificationResult.notification;

  if (notificationResult.created) {
    await sendManagerPushNotification({
      userId: managerUserId,
      title,
      body,
      data: {
        notificationId: notification?._id?.toString(),
        notificationType: type,
        groupId: groupId?.toString(),
        cycleId: cycleId?.toString(),
      },
    });
  }

  const members = await listMembers(groupId, { membershipStatus: "ACTIVE" }, 0, 1000);
  const messages = await Promise.all(members
    .filter((member) => member.primaryContactNumber)
    .map((member) => createWhatsAppMessageIfMissing({
      memberId: member._id,
      groupId,
      cycleId,
      messageType: type,
      templateId,
      recipientNumber: member.primaryContactNumber,
      status: "QUEUED",
      attemptCount: 0,
      reminderKey: dedupeKey,
      dedupeKey: `${dedupeKey}:member:${member._id.toString()}`,
      content: { ...content, memberName: member.fullName || null },
      queuedAt: createdAt,
      createdBy,
    })));

  return { notification, messages };
};
