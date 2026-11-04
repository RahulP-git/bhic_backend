import { Router } from "express";
import { asyncHandler, successResponse } from "../../common/http.js";
import { AppError } from "../../common/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { getDatabase } from "../../db/mongo.js";
import {
  addGroupMember,
  closeBhicGroup,
  completeBhicCycle,
  correctSelectedWinner,
  correctCashCollection,
  createBhicGroup,
  createDistributionDraft,
  generateGroupSchedule,
  getCollectionSummary,
  getCollections,
  getCycle,
  getDistribution,
  getGroup,
  getGroupCycles,
  getGroupDashboard,
  getGroupMember,
  getGroupMembers,
  getGroups,
  getManagerNotifications,
  getParticipants,
  eligibleWinners,
  publishDistribution,
  queueWhatsAppMessage,
  readAllNotifications,
  readNotification,
  recordCashCollection,
  removeGroupMember,
  resendMemberInformation,
  saveSettlement,
  saveWinner,
  startBhicCycle,
  updateBhicGroup,
  updateDistributionInputs,
  updateGroupMember,
  validateDistribution,
} from "./bhic.service.js";

export const bhicRouter = Router();
bhicRouter.use(requireAuth);

bhicRouter.post("/groups", asyncHandler(async (req, res) => successResponse(res, await createBhicGroup(req.body, req.auth.user._id, req.requestId), 201)));
bhicRouter.get("/groups", asyncHandler(async (req, res) => successResponse(res, await getGroups(req.auth.user._id, req.query))));
bhicRouter.get("/groups/:groupId", asyncHandler(async (req, res) => successResponse(res, await getGroup(req.params.groupId, req.auth.user._id))));
bhicRouter.patch("/groups/:groupId", asyncHandler(async (req, res) => successResponse(res, await updateBhicGroup(req.params.groupId, req.body, req.auth.user._id, req.requestId))));
bhicRouter.get("/groups/:groupId/dashboard", asyncHandler(async (req, res) => successResponse(res, await getGroupDashboard(req.params.groupId, req.auth.user._id))));
bhicRouter.post("/groups/:groupId/close", asyncHandler(async (req, res) => successResponse(res, await closeBhicGroup(req.params.groupId, req.body?.reason, req.auth.user._id, req.requestId))));

bhicRouter.post("/groups/:groupId/members", asyncHandler(async (req, res) => successResponse(res, await addGroupMember(req.params.groupId, req.body, req.auth.user, req.requestId), 201)));
bhicRouter.post("/groups/:groupId/members/:memberId/whatsapp-information", asyncHandler(async (req, res) => successResponse(res, await resendMemberInformation(req.params.groupId, req.params.memberId, req.auth.user, req.requestId), 201)));
bhicRouter.get("/groups/:groupId/members", asyncHandler(async (req, res) => successResponse(res, await getGroupMembers(req.params.groupId, req.query, req.auth.user._id))));
bhicRouter.get("/groups/:groupId/members/:memberId", asyncHandler(async (req, res) => successResponse(res, await getGroupMember(req.params.groupId, req.params.memberId, req.auth.user._id))));
bhicRouter.patch("/groups/:groupId/members/:memberId", asyncHandler(async (req, res) => successResponse(res, await updateGroupMember(req.params.groupId, req.params.memberId, req.body, req.auth.user._id, req.requestId))));
bhicRouter.post("/groups/:groupId/members/:memberId/remove", asyncHandler(async (req, res) => successResponse(res, await removeGroupMember(req.params.groupId, req.params.memberId, req.body?.reason, req.auth.user._id, req.requestId))));

bhicRouter.get("/groups/:groupId/cycles", asyncHandler(async (req, res) => successResponse(res, await getGroupCycles(req.params.groupId, req.auth.user._id))));
bhicRouter.post("/groups/:groupId/schedule/generate", asyncHandler(async (req, res) => successResponse(res, await generateGroupSchedule(req.params.groupId, req.auth.user._id, req.requestId))));
bhicRouter.get("/cycles/:cycleId", asyncHandler(async (req, res) => successResponse(res, await getCycle(req.params.cycleId, req.auth.user._id))));
bhicRouter.post("/cycles/:cycleId/start", asyncHandler(async (req, res) => successResponse(res, await startBhicCycle(req.params.cycleId, req.auth.user._id, req.requestId))));
bhicRouter.get("/cycles/:cycleId/participants", asyncHandler(async (req, res) => successResponse(res, await getParticipants(req.params.cycleId, req.auth.user._id))));

bhicRouter.post("/cycles/:cycleId/collections", asyncHandler(async (req, res) => successResponse(res, await recordCashCollection(req.params.cycleId, req.body, req.auth.user._id, req.requestId), 201)));
bhicRouter.get("/cycles/:cycleId/collections", asyncHandler(async (req, res) => successResponse(res, await getCollections(req.params.cycleId, req.auth.user._id))));
bhicRouter.post("/cycles/:cycleId/collections/:collectionId/correct", asyncHandler(async (req, res) => successResponse(res, await correctCashCollection(req.params.cycleId, req.params.collectionId, req.body?.reason, req.auth.user._id, req.requestId))));
bhicRouter.get("/cycles/:cycleId/collections/summary", asyncHandler(async (req, res) => successResponse(res, await getCollectionSummary(req.params.cycleId, req.auth.user._id))));

bhicRouter.get("/cycles/:cycleId/winner/eligible-members", asyncHandler(async (req, res) => successResponse(res, await eligibleWinners(req.params.cycleId, req.auth.user._id))));
bhicRouter.post("/cycles/:cycleId/winner", asyncHandler(async (req, res) => successResponse(res, await saveWinner(req.params.cycleId, req.body, req.auth.user._id, req.requestId), 201)));
bhicRouter.post("/cycles/:cycleId/winner/correct", asyncHandler(async (req, res) => successResponse(res, await correctSelectedWinner(req.params.cycleId, req.body?.reason, req.auth.user._id, req.requestId))));
bhicRouter.post("/cycles/:cycleId/settlement", asyncHandler(async (req, res) => successResponse(res, await saveSettlement(req.params.cycleId, req.body, req.auth.user._id, req.requestId), 201)));

bhicRouter.post("/cycles/:cycleId/distribution/draft", asyncHandler(async (req, res) => successResponse(res, await createDistributionDraft(req.params.cycleId, req.auth.user._id, req.requestId), 201)));
bhicRouter.get("/cycles/:cycleId/distribution", asyncHandler(async (req, res) => successResponse(res, await getDistribution(req.params.cycleId, req.auth.user._id))));
bhicRouter.patch("/cycles/:cycleId/distribution", asyncHandler(async (req, res) => successResponse(res, await updateDistributionInputs(req.params.cycleId, req.body, req.auth.user._id, req.requestId))));
bhicRouter.post("/cycles/:cycleId/distribution/validate", asyncHandler(async (req, res) => successResponse(res, await validateDistribution(req.params.cycleId, req.auth.user._id))));
bhicRouter.post("/cycles/:cycleId/distribution/publish", asyncHandler(async (req, res) => successResponse(res, await publishDistribution(req.params.cycleId, req.auth.user._id, req.requestId))));
bhicRouter.post("/cycles/:cycleId/complete", asyncHandler(async (req, res) => successResponse(res, await completeBhicCycle(req.params.cycleId, req.auth.user._id, req.requestId))));

bhicRouter.get("/notifications", asyncHandler(async (req, res) => successResponse(res, await getManagerNotifications(req.auth.user._id, req.query))));
bhicRouter.patch("/notifications/:notificationId/read", asyncHandler(async (req, res) => successResponse(res, await readNotification(req.params.notificationId, req.auth.user._id))));
bhicRouter.post("/notifications/read-all", asyncHandler(async (req, res) => successResponse(res, await readAllNotifications(req.auth.user._id))));
bhicRouter.post("/notifications/devices", asyncHandler(async (req, res) => {
  const { pushProvider, token, platform, appVersion } = req.body || {};
  if (!pushProvider || !token || !platform) throw new AppError("VALIDATION_ERROR", "pushProvider, token, and platform are required", 400);
  const device = { userId: req.auth.user._id, pushProvider, token, platform, appVersion: appVersion || null, lastSeenAt: new Date(), updatedAt: new Date() };
  await getDatabase().collection("notification_devices").updateOne({ userId: device.userId, token }, { $set: device, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  successResponse(res, device, 201);
}));

bhicRouter.post("/messages/whatsapp/group-information", asyncHandler(async (req, res) => successResponse(res, await queueWhatsAppMessage({ ...req.body, messageType: "GROUP_INFORMATION" }, req.auth.user._id, req.requestId), 201)));
bhicRouter.post("/messages/whatsapp/cycle-reminder", asyncHandler(async (req, res) => successResponse(res, await queueWhatsAppMessage({ ...req.body, messageType: "CYCLE_REMINDER" }, req.auth.user._id, req.requestId), 201)));
bhicRouter.post("/messages/whatsapp/cycle-completed", asyncHandler(async (req, res) => successResponse(res, await queueWhatsAppMessage({ ...req.body, messageType: "CYCLE_COMPLETED" }, req.auth.user._id, req.requestId), 201)));
