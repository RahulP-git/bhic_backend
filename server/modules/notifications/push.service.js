import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../../config/env.js";
import { getDatabase } from "../../db/mongo.js";

let messagingClient;
let initializationAttempted = false;

const getMessagingClient = () => {
  if (!env.fcmEnabled || !env.fcmProjectId) return null;
  if (messagingClient) return messagingClient;
  if (initializationAttempted) return null;
  initializationAttempted = true;
  try {
    const app = getApps()[0] || initializeApp({
      credential: applicationDefault(),
      projectId: env.fcmProjectId,
    });
    messagingClient = getMessaging(app);
    return messagingClient;
  } catch (error) {
    console.error("[PUSH] Firebase initialization failed", error.message);
    return null;
  }
};

const removeInvalidDevice = async (userId, token) => {
  await getDatabase().collection("notification_devices").deleteOne({ userId, token });
};

export const sendManagerPushNotification = async ({ userId, title, body, data = {} }) => {
  const messaging = getMessagingClient();
  if (!messaging) return { enabled: false, sent: 0, reason: "FCM is not configured" };

  const devices = await getDatabase().collection("notification_devices")
    .find({ userId, pushProvider: "FCM" })
    .toArray();
  if (!devices.length) return { enabled: true, sent: 0, reason: "No registered FCM devices" };

  const stringData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)]));
  const results = await Promise.all(devices.map(async (device) => {
    try {
      const messageId = await messaging.send({
        token: device.token,
        notification: { title, body },
        data: stringData,
        android: { priority: "high", notification: { channelId: "bhic_notifications" } },
      });
      return { token: device.token, sent: true, messageId };
    } catch (error) {
      const invalidToken = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error.code);
      if (invalidToken) await removeInvalidDevice(userId, device.token);
      console.error("[PUSH] Device delivery failed", { userId: userId.toString(), token: `${device.token.slice(0, 8)}...`, code: error.code, message: error.message });
      return { token: device.token, sent: false, code: error.code };
    }
  }));
  return { enabled: true, sent: results.filter((item) => item.sent).length, failed: results.filter((item) => !item.sent).length };
};
