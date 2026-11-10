import { AppError } from "../../common/errors.js";
import { moneyToRupees, parseDate, roundRupees, serialize, toObjectId } from "../../common/mongo.js";
import { normalizeMobileNumber, optionalString, requireString } from "../../common/validation.js";
import { getDatabase } from "../../db/mongo.js";
import { createWhatsAppMessage } from "../../models/whatsapp-messages.model.js";
import { createNotification, countNotifications, listNotifications, markAllNotificationsRead, markNotificationRead } from "../../models/notifications.model.js";
import { countActiveMembers, countMembers, createMember, findMember, listMembers, updateMember } from "../../models/group-members.model.js";
import { countGroups, createGroup, findGroup, findGroupById, listGroups, updateGroup } from "../../models/groups.model.js";
import { createCycles, findCycle, listCycles, updateCycle } from "../../models/cycles.model.js";
import { createParticipants, findParticipant, listParticipants, updateParticipant } from "../../models/cycle-participants.model.js";
import { createCollection, correctCollection, findCollection, listCollections } from "../../models/cash-collections.model.js";
import { correctWinner, createWinner, findWinner, hasMemberWon } from "../../models/winners.model.js";
import { createSettlement, findSettlement } from "../../models/settlements.model.js";
import { createDistribution, createDistributionItems, findDistribution, listDistributionItems, updateDistribution } from "../../models/distributions.model.js";
import { writeAuditLog } from "../../models/audit-logs.model.js";
import { findUserById } from "../../models/users.model.js";

const now = () => new Date();
const page = (value, fallback, max) => Math.min(Math.max(Number(value) || fallback, 1), max);
const toPublic = (value) => serialize(value);

// A manager is a real member of every group they own. This also repairs groups
// created before manager membership was introduced, so all member-consuming
// endpoints see the same first member without requiring a manual migration.
const ensureManagerMember = async (group, userId) => {
  const members = getDatabase().collection("group_members");
  const existing = await members.findOne({ groupId: group._id, managerUserId: userId });
  if (existing) {
    await members.updateMany(
      { groupId: group._id, memberOrder: { $exists: false }, isManager: { $ne: true } },
      { $set: { isManager: false, memberOrder: 1, updatedAt: now() } },
    );
    return existing;
  }

  const user = await findUserById(userId);
  if (!user?.mobileNumber) return null;
  const normalizedPrimaryContact = normalizeMobileNumber(user.mobileNumber);
  const nowValue = now();
  const contactMatch = await members.findOne({ groupId: group._id, normalizedPrimaryContact });
  if (contactMatch) {
    const updated = await members.findOneAndUpdate(
      { _id: contactMatch._id },
      { $set: { managerUserId: userId, isManager: true, memberOrder: 0, updatedAt: nowValue } },
      { returnDocument: "after" },
    );
    await members.updateMany(
      { groupId: group._id, memberOrder: { $exists: false }, isManager: { $ne: true } },
      { $set: { isManager: false, memberOrder: 1, updatedAt: now() } },
    );
    return updated.value || updated;
  }

  const member = {
    groupId: group._id,
    managerUserId: userId,
    isManager: true,
    memberOrder: 0,
    fullName: user.managerName || "Group Manager",
    primaryContactNumber: user.mobileNumber,
    normalizedPrimaryContact,
    optionalContactNumber: undefined,
    address: "Group Manager",
    description: "Logged-in group manager",
    membershipStatus: "ACTIVE",
    allocationStatus: "NOT_ALLOCATED",
    wonCycleIds: [],
    joinedAt: nowValue,
    createdAt: nowValue,
    updatedAt: nowValue,
  };
  const result = await members.insertOne(member);
  await members.updateMany(
    { groupId: group._id, memberOrder: { $exists: false }, isManager: { $ne: true } },
    { $set: { isManager: false, memberOrder: 1, updatedAt: now() } },
  );
  return { ...member, _id: result.insertedId };
};

const ensureGroup = async (groupId, managerId) => {
  const group = await findGroup(toObjectId(groupId, "groupId"), managerId);
  if (!group) throw new AppError("NOT_FOUND", "Group not found", 404);
  await ensureManagerMember(group, managerId);
  return group;
};

const ensureCycle = async (cycleId, managerId) => {
  const cycle = await findCycle(toObjectId(cycleId, "cycleId"));
  if (!cycle) throw new AppError("NOT_FOUND", "Cycle not found", 404);
  await ensureGroup(cycle.groupId, managerId);
  return cycle;
};

const scheduledDate = (date, time, timezone) => {
  const suffix = timezone === "Asia/Kolkata" ? "+05:30" : "Z";
  return new Date(`${date}T${time}:00${suffix}`);
};

const addMonths = (date, months) => {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
};

const validateGroupInput = (body) => {
  const name = requireString(body.name, "name", { min: 2, max: 150 });
  const startDate = requireString(body.startDate, "startDate", { min: 10, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new AppError("VALIDATION_ERROR", "startDate must use YYYY-MM-DD", 400);
  const startTime = requireString(body.startTime, "startTime", { min: 5, max: 5 });
  if (!/^\d{2}:\d{2}$/.test(startTime)) throw new AppError("VALIDATION_ERROR", "startTime must use HH:mm", 400);
  const timezone = requireString(body.timezone || "Asia/Kolkata", "timezone", { min: 3, max: 100 });
  const frequency = body.frequency || "MONTHLY";
  if (frequency !== "MONTHLY") throw new AppError("VALIDATION_ERROR", "Only MONTHLY frequency is supported", 400);
  const contributionAmount = moneyToRupees(body.contributionAmount, "contributionAmount");
  // The total BHIC amount is derived from the configured member count. The
  // client may display/send totalBhicAmount, but the server remains authoritative.
  const controlledAmount = moneyToRupees(body.controlledAmount, "controlledAmount");
  const memberLimit = Number(body.memberLimit);
  if (!Number.isInteger(memberLimit) || memberLimit < 1 || memberLimit > 1000) {
    throw new AppError("VALIDATION_ERROR", "memberLimit must be an integer between 1 and 1000", 400);
  }
  const totalBhicAmount = contributionAmount * memberLimit;
  if (contributionAmount <= 0 || totalBhicAmount <= 0) throw new AppError("VALIDATION_ERROR", "Financial amounts must be greater than zero", 400);
  if (controlledAmount > totalBhicAmount) throw new AppError("RULE_CONTRADICTION", "controlledAmount cannot exceed totalBhicAmount", 400);
  const rules = body.rules && typeof body.rules === "object" && !Array.isArray(body.rules) ? body.rules : {};
  return { name, description: optionalString(body.description, "description", { max: 1000 }), startDate, startTime, timezone, frequency, contributionAmount, totalBhicAmount, controlledAmount, memberLimit, rules };
};

const buildCycles = (groupId, input, count, startNumber = 1) => {
  const first = scheduledDate(input.startDate, input.startTime, input.timezone);
  return Array.from({ length: count }, (_, index) => {
    const scheduledStart = addMonths(first, index + startNumber - 1);
    return {
      groupId,
      bhicNumber: startNumber + index,
      scheduledStart,
      status: "SCHEDULED",
      expectedTotal: input.contributionAmount * input.memberLimit,
      totalCollected: 0,
      totalOutstanding: input.contributionAmount * input.memberLimit,
      activeRuleVersion: 1,
      createdAt: now(),
      updatedAt: now(),
    };
  });
};

export const createBhicGroup = async (body, userId, requestId) => {
  const input = validateGroupInput(body);
  const createdAt = now();
  const group = { ...input, managerId: userId, status: "ACTIVE", currentCycleNumber: 1, activeRuleVersion: 1, createdAt, updatedAt: createdAt };
  const result = await createGroup(group);
  const groupId = result.insertedId;
  await getDatabase().collection("group_rule_versions").insertOne({ groupId, version: 1, ...input.rules, effectiveFrom: createdAt, createdBy: userId, createdAt });
  await ensureManagerMember({ ...group, _id: groupId }, userId);
  await createCycles(buildCycles(groupId, input, input.memberLimit));
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "GROUP_CREATED", entityType: "GROUP", entityId: groupId, requestId });
  return toPublic({ ...group, _id: groupId });
};

export const getGroups = async (userId, query) => {
  const limit = page(query.limit, 20, 100);
  const pageNumber = page(query.page, 1, 1000000);
  const filter = query.status ? { status: query.status } : {};
  if (query.search) filter.name = { $regex: String(query.search).trim(), $options: "i" };
  const [items, total] = await Promise.all([listGroups(userId, filter, (pageNumber - 1) * limit, limit), countGroups(userId, filter)]);
  return { items: toPublic(items), total, page: pageNumber, pageSize: limit, hasNextPage: pageNumber * limit < total };
};

export const getGroup = async (groupId, userId) => toPublic(await ensureGroup(groupId, userId));

export const updateBhicGroup = async (groupId, body, userId, requestId) => {
  const group = await ensureGroup(groupId, userId);
  if (["CLOSED"].includes(group.status)) throw new AppError("INVALID_STATE", "Closed groups cannot be updated", 409);
  const updates = {};
  for (const field of ["name", "description", "startTime", "timezone"]) if (body[field] !== undefined) updates[field] = requireString(body[field], field, { min: 1, max: field === "description" ? 1000 : 150 });
  if (body.rules !== undefined) {
    if (!body.rules || typeof body.rules !== "object" || Array.isArray(body.rules)) throw new AppError("VALIDATION_ERROR", "rules must be an object", 400);
    updates.activeRuleVersion = (group.activeRuleVersion || 1) + 1;
    await getDatabase().collection("group_rule_versions").insertOne({ groupId: group._id, version: updates.activeRuleVersion, ...body.rules, effectiveFrom: now(), createdBy: userId, createdAt: now() });
  }
  if (!Object.keys(updates).length) throw new AppError("VALIDATION_ERROR", "At least one editable field is required", 400);
  const updated = await updateGroup(group._id, updates);
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "GROUP_UPDATED", entityType: "GROUP", entityId: group._id, requestId, afterSummary: updates });
  return toPublic(updated.value || updated);
};

export const closeBhicGroup = async (groupId, reason, userId, requestId) => {
  const group = await ensureGroup(groupId, userId);
  const unfinished = await getDatabase().collection("cycles").countDocuments({ groupId: group._id, status: { $nin: ["COMPLETED", "CANCELLED"] } });
  if (unfinished > 0 && !reason) throw new AppError("INVALID_STATE", "A closure reason is required while cycles remain unfinished", 409);
  const updated = await updateGroup(group._id, { status: "CLOSED", closedAt: now(), closureReason: reason || null });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "GROUP_CLOSED", entityType: "GROUP", entityId: group._id, requestId, reason });
  return toPublic(updated.value || updated);
};

export const addGroupMember = async (groupId, body, user, requestId) => {
  const group = await ensureGroup(groupId, user._id);
  const fullName = requireString(body.fullName, "fullName", { min: 2, max: 150 });
  const primaryContactNumber = normalizeMobileNumber(body.primaryContactNumber);
  const optionalContactNumber = body.optionalContactNumber ? normalizeMobileNumber(body.optionalContactNumber) : undefined;
  const address = requireString(body.address, "address", { min: 5, max: 1000 });
  const description = optionalString(body.description, "description", { max: 1000 });
  const activeCount = await countActiveMembers(group._id);
  if (activeCount >= group.memberLimit) throw new AppError("CONFLICT", "Group member limit has been reached", 409);
  const duplicate = await getDatabase().collection("group_members").findOne({ groupId: group._id, normalizedPrimaryContact: primaryContactNumber, membershipStatus: { $ne: "REMOVED" } });
  if (duplicate) throw new AppError("DUPLICATE_MEMBER", "Member already exists in this group", 409);
  const member = { groupId: group._id, isManager: false, memberOrder: activeCount + 1, fullName, primaryContactNumber, normalizedPrimaryContact: primaryContactNumber, optionalContactNumber, address, description, membershipStatus: "ACTIVE", allocationStatus: "NOT_ALLOCATED", wonCycleIds: [], joinedAt: now(), createdAt: now(), updatedAt: now() };
  const result = await createMember(member);
  const memberId = result.insertedId;
  const message = await queueMemberInformation(group, { ...member, _id: memberId }, user);
  await writeAuditLog({ actorType: "MANAGER", actorId: user._id, action: "MEMBER_CREATED", entityType: "GROUP_MEMBER", entityId: memberId, requestId });
  return { member: toPublic({ ...member, _id: memberId }), message: toPublic(message) };
};

const queueMemberInformation = async (group, member, user) => {
  const result = await createWhatsAppMessage({ memberId: member._id, groupId: group._id, messageType: "GROUP_INFORMATION", templateId: "group-information", recipientNumber: member.primaryContactNumber, status: "QUEUED", attemptCount: 0, queuedAt: now(), content: { groupName: group.name, managerName: user.managerName, contributionAmount: roundRupees(group.contributionAmount), startDate: group.startDate, startTime: group.startTime, rules: group.rules } });
  return { ...result, _id: result.insertedId };
};

export const resendMemberInformation = async (groupId, memberId, user, requestId) => {
  const group = await ensureGroup(groupId, user._id);
  const member = await findMember(toObjectId(memberId, "memberId"), group._id);
  if (!member) throw new AppError("NOT_FOUND", "Member not found", 404);
  const message = await queueMemberInformation(group, member, user);
  await writeAuditLog({ actorType: "MANAGER", actorId: user._id, action: "MEMBER_WHATSAPP_RESENT", entityType: "GROUP_MEMBER", entityId: member._id, requestId });
  return toPublic(message);
};

export const getGroupMembers = async (groupId, query, userId) => {
  const group = await ensureGroup(groupId, userId);
  const limit = page(query.limit, 50, 100);
  const pageNumber = page(query.page, 1, 1000000);
  const filter = query.status ? { membershipStatus: String(query.status).toUpperCase() } : {};
  const [items, total] = await Promise.all([listMembers(group._id, filter, (pageNumber - 1) * limit, limit), countMembers(group._id, filter)]);
  return { items: toPublic(items), total, page: pageNumber, pageSize: limit, hasNextPage: pageNumber * limit < total };
};

export const getGroupMember = async (groupId, memberId, userId) => {
  const group = await ensureGroup(groupId, userId);
  const member = await findMember(toObjectId(memberId, "memberId"), group._id);
  if (!member) throw new AppError("NOT_FOUND", "Member not found", 404);
  const collections = await getDatabase().collection("cash_collections").find({ memberId: member._id }).toArray();
  return toPublic({ ...member, collectionSummary: { total: collections.reduce((sum, item) => sum + item.amount, 0), count: collections.length } });
};

export const updateGroupMember = async (groupId, memberId, body, userId, requestId) => {
  const group = await ensureGroup(groupId, userId);
  const member = await findMember(toObjectId(memberId, "memberId"), group._id);
  if (!member) throw new AppError("NOT_FOUND", "Member not found", 404);
  const updates = {};
  if (body.fullName !== undefined) updates.fullName = requireString(body.fullName, "fullName", { min: 2, max: 150 });
  if (body.primaryContactNumber !== undefined) { updates.primaryContactNumber = normalizeMobileNumber(body.primaryContactNumber); updates.normalizedPrimaryContact = updates.primaryContactNumber; }
  if (body.optionalContactNumber !== undefined) updates.optionalContactNumber = body.optionalContactNumber ? normalizeMobileNumber(body.optionalContactNumber) : null;
  if (body.address !== undefined) updates.address = requireString(body.address, "address", { min: 5, max: 1000 });
  if (body.description !== undefined) updates.description = optionalString(body.description, "description", { max: 1000 });
  if (!Object.keys(updates).length) throw new AppError("VALIDATION_ERROR", "No editable fields provided", 400);
  const updated = await updateMember(member._id, updates);
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "MEMBER_UPDATED", entityType: "GROUP_MEMBER", entityId: member._id, requestId, afterSummary: updates });
  return toPublic(updated.value || updated);
};

export const removeGroupMember = async (groupId, memberId, reason, userId, requestId) => {
  const group = await ensureGroup(groupId, userId);
  const member = await findMember(toObjectId(memberId, "memberId"), group._id);
  if (!member) throw new AppError("NOT_FOUND", "Member not found", 404);
  const financialRecords = await getDatabase().collection("cash_collections").countDocuments({ memberId: member._id });
  const updates = { membershipStatus: financialRecords ? "INACTIVE" : "REMOVED", removedAt: now(), removalReason: reason || null };
  const updated = await updateMember(member._id, updates);
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "MEMBER_REMOVED", entityType: "GROUP_MEMBER", entityId: member._id, requestId, reason, afterSummary: updates });
  return toPublic(updated.value || updated);
};

export const getGroupCycles = async (groupId, userId) => { const group = await ensureGroup(groupId, userId); return toPublic(await listCycles(group._id)); };

export const generateGroupSchedule = async (groupId, userId, requestId) => {
  const group = await ensureGroup(groupId, userId);
  const existing = await listCycles(group._id);
  const remaining = group.memberLimit - existing.length;
  if (remaining > 0) await createCycles(buildCycles(group._id, group, remaining, existing.length + 1));
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "SCHEDULE_GENERATED", entityType: "GROUP", entityId: group._id, requestId });
  return toPublic(await listCycles(group._id));
};

export const startBhicCycle = async (cycleId, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  if (cycle.status !== "SCHEDULED") return toPublic(cycle);
  if (cycle.scheduledStart > now()) throw new AppError("INVALID_STATE", "Cycle cannot start before its scheduled time", 409);
  const group = await ensureGroup(cycle.groupId, userId);
  const members = await listMembers(group._id, { membershipStatus: "ACTIVE" }, 0, group.memberLimit);
  if (!members.length) throw new AppError("INVALID_STATE", "At least one active member is required", 409);
  if (members.length !== group.memberLimit) {
    throw new AppError("INVALID_STATE", `Add all ${group.memberLimit - members.length} remaining member(s) before starting BHIC`, 409);
  }
  const participants = members.map((member) => ({ cycleId: cycle._id, memberId: member._id, expectedContribution: group.contributionAmount, collectedAmount: 0, outstandingAmount: group.contributionAmount, collectionStatus: "UNPAID", eligibleForWinner: true, previousWinnerFlag: Boolean(member.wonCycleIds?.length), distributionStatus: "PENDING", createdAt: now(), updatedAt: now() }));
  await createParticipants(participants);
  const updated = await updateCycle(cycle._id, { status: "COLLECTING_CONTRIBUTIONS", actualStart: now(), expectedTotal: group.contributionAmount * members.length, totalOutstanding: group.contributionAmount * members.length });
  await updateGroup(group._id, { currentCycleNumber: cycle.bhicNumber });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "CYCLE_STARTED", entityType: "CYCLE", entityId: cycle._id, requestId });
  return toPublic(updated.value || updated);
};

export const getCycle = async (cycleId, userId) => { const cycle = await ensureCycle(cycleId, userId); return toPublic(cycle); };
export const getParticipants = async (cycleId, userId) => { const cycle = await ensureCycle(cycleId, userId); return toPublic(await listParticipants(cycle._id)); };

export const recordCashCollection = async (cycleId, body, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  if (!["COLLECTING_CONTRIBUTIONS", "READY_FOR_WINNER_SELECTION"].includes(cycle.status)) throw new AppError("INVALID_STATE", "Collections are not open for this cycle", 409);
  const memberId = toObjectId(body.memberId, "memberId");
  const participant = await findParticipant(cycle._id, memberId);
  if (!participant) throw new AppError("NOT_FOUND", "Member is not a participant in this cycle", 404);
  const amount = moneyToRupees(body.amount, "amount");
  if (!amount) throw new AppError("VALIDATION_ERROR", "amount must be greater than zero", 400);
  if (amount > participant.outstandingAmount) throw new AppError("AMOUNT_MISMATCH", "Collection cannot exceed the outstanding amount", 400);
  const method = body.method || "CASH";
  if (!["CASH", "OFFLINE"].includes(method)) throw new AppError("VALIDATION_ERROR", "method must be CASH or OFFLINE", 400);
  const collectedAt = body.collectedAt ? parseDate(body.collectedAt, "collectedAt") : now();
  const item = { cycleId: cycle._id, groupId: cycle.groupId, memberId, amount, method, collectedAt, collectedBy: userId, reference: optionalString(body.reference, "reference", { max: 150 }), note: optionalString(body.note, "note", { max: 1000 }), status: "POSTED", createdAt: now(), updatedAt: now() };
  const result = await createCollection(item);
  const collectedAmount = participant.collectedAmount + amount;
  const outstandingAmount = participant.outstandingAmount - amount;
  await updateParticipant(cycle._id, memberId, { collectedAmount, outstandingAmount, collectionStatus: outstandingAmount === 0 ? "PAID" : "PARTIAL" });
  const newCollected = cycle.totalCollected + amount;
  const newOutstanding = Math.max(cycle.expectedTotal - newCollected, 0);
  const status = newOutstanding === 0 ? "READY_FOR_WINNER_SELECTION" : cycle.status;
  await updateCycle(cycle._id, { totalCollected: newCollected, totalOutstanding: newOutstanding, status });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "CASH_COLLECTION_RECORDED", entityType: "CASH_COLLECTION", entityId: result.insertedId, requestId });
  return toPublic({ ...item, _id: result.insertedId });
};

export const getCollections = async (cycleId, userId) => { const cycle = await ensureCycle(cycleId, userId); const items = await listCollections(cycle._id); return toPublic({ items, totals: { expected: roundRupees(cycle.expectedTotal), collected: roundRupees(cycle.totalCollected), outstanding: roundRupees(cycle.totalOutstanding) } }); };
export const getCollectionSummary = async (cycleId, userId) => { const cycle = await ensureCycle(cycleId, userId); const participants = await listParticipants(cycle._id); return { expectedTotal: roundRupees(cycle.expectedTotal), collectedTotal: roundRupees(cycle.totalCollected), outstandingTotal: roundRupees(cycle.totalOutstanding), paidMemberCount: participants.filter((item) => item.collectionStatus === "PAID").length, partialMemberCount: participants.filter((item) => item.collectionStatus === "PARTIAL").length, unpaidMemberCount: participants.filter((item) => item.collectionStatus === "UNPAID").length }; };

export const correctCashCollection = async (cycleId, collectionId, reason, userId, requestId) => {
  if (!reason || reason.trim().length < 5) throw new AppError("VALIDATION_ERROR", "A correction reason of at least 5 characters is required", 400);
  const cycle = await ensureCycle(cycleId, userId);
  const item = await findCollection(toObjectId(collectionId, "collectionId"), cycle._id);
  if (!item) throw new AppError("NOT_FOUND", "Collection not found", 404);
  const updated = await correctCollection(item._id, cycle._id, { status: "CORRECTED", correctionReason: reason.trim(), correctedBy: userId, correctedAt: now() });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "CASH_COLLECTION_CORRECTED", entityType: "CASH_COLLECTION", entityId: item._id, requestId, reason });
  return toPublic(updated.value || updated);
};

export const eligibleWinners = async (cycleId, userId) => {
  const cycle = await ensureCycle(cycleId, userId);
  const participants = await listParticipants(cycle._id);
  const members = await Promise.all(participants.filter((item) => item.eligibleForWinner && !item.previousWinnerFlag).map((item) => findMember(item.memberId, cycle.groupId)));
  const eligible = [];
  for (const member of members) if (member && !(await hasMemberWon(cycle.groupId, member._id))) eligible.push(member);
  return toPublic(eligible);
};

export const saveWinner = async (cycleId, body, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  if (cycle.status !== "READY_FOR_WINNER_SELECTION") throw new AppError("INVALID_STATE", "Winner can be selected only after collections are complete", 409);
  if (await findWinner(cycle._id)) throw new AppError("WINNER_ALREADY_SELECTED", "Winner already selected for this cycle", 409);
  const winnerMemberId = toObjectId(body.winnerMemberId, "winnerMemberId");
  const eligible = await eligibleWinners(cycleId, userId);
  if (!eligible.some((member) => member._id.toString() === winnerMemberId.toString())) throw new AppError("MEMBER_NOT_ELIGIBLE", "Selected member is not eligible", 400);
  const winnerAmount = moneyToRupees(body.winnerAmount, "winnerAmount");
  const receivedAmount = moneyToRupees(body.receivedAmount, "receivedAmount");
  if (!winnerAmount || !receivedAmount || winnerAmount <= 0 || receivedAmount <= 0) throw new AppError("VALIDATION_ERROR", "winnerAmount and receivedAmount must be positive", 400);
  const winner = { cycleId: cycle._id, groupId: cycle.groupId, memberId: winnerMemberId, winnerAmount, receivedAmount, remainingAmount: winnerAmount - receivedAmount, selectedBy: userId, selectedAt: now(), note: optionalString(body.note, "note", { max: 1000 }), status: "SELECTED", createdAt: now() };
  const result = await createWinner(winner);
  await updateCycle(cycle._id, { winnerId: result.insertedId, winnerAmount, receivedAmount, remainingAmount: winner.remainingAmount, status: "SETTLEMENT_PENDING" });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "WINNER_SELECTED", entityType: "WINNER", entityId: result.insertedId, requestId });
  return toPublic({ ...winner, _id: result.insertedId });
};

export const correctSelectedWinner = async (cycleId, reason, userId, requestId) => {
  if (!reason || reason.trim().length < 5) throw new AppError("VALIDATION_ERROR", "A correction reason of at least 5 characters is required", 400);
  const cycle = await ensureCycle(cycleId, userId);
  const winner = await findWinner(cycle._id);
  if (!winner) throw new AppError("NOT_FOUND", "Winner not found", 404);
  const updated = await correctWinner(cycle._id, { correctedBy: userId, correctionReason: reason.trim() });
  await updateCycle(cycle._id, { winnerId: null, winnerAmount: null, receivedAmount: null, remainingAmount: null, status: "READY_FOR_WINNER_SELECTION" });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "WINNER_CORRECTED", entityType: "WINNER", entityId: winner._id, requestId, reason });
  return toPublic(updated.value || updated);
};

export const saveSettlement = async (cycleId, body, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  const winner = await findWinner(cycle._id);
  if (!winner) throw new AppError("INVALID_STATE", "Winner must be selected first", 409);
  if (await findSettlement(cycle._id)) throw new AppError("CONFLICT", "Settlement already recorded", 409);
  const actualAmount = moneyToRupees(body.actualAmount, "actualAmount");
  const expectedAmount = moneyToRupees(body.expectedAmount, "expectedAmount");
  if (expectedAmount !== winner.remainingAmount && expectedAmount !== winner.receivedAmount) throw new AppError("AMOUNT_MISMATCH", "expectedAmount does not match the winner record", 400);
  if (actualAmount !== expectedAmount) throw new AppError("AMOUNT_MISMATCH", "actualAmount must match expectedAmount", 400);
  const method = body.method || "CASH";
  if (!["CASH", "OFFLINE"].includes(method)) throw new AppError("VALIDATION_ERROR", "method must be CASH or OFFLINE", 400);
  const settlement = { cycleId: cycle._id, winnerRecordId: winner._id, expectedAmount, actualAmount, method, reference: optionalString(body.reference, "reference", { max: 150 }), note: optionalString(body.note, "note", { max: 1000 }), settledBy: userId, settledAt: body.settledAt ? parseDate(body.settledAt, "settledAt") : now(), status: "SETTLED", createdAt: now() };
  const result = await createSettlement(settlement);
  await updateCycle(cycle._id, { status: "SETTLED" });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "WINNER_SETTLED", entityType: "SETTLEMENT", entityId: result.insertedId, requestId });
  return toPublic({ ...settlement, _id: result.insertedId });
};

const calculateDistribution = (members, sourceAmount, interestRate) => {
  if (!members.length) throw new AppError("INVALID_STATE", "No members are eligible for distribution", 409);
  const baseAmount = Math.floor(sourceAmount / members.length);
  const remainder = sourceAmount - baseAmount * members.length;
  return members.map((member, index) => {
    const base = baseAmount + (index === 0 ? remainder : 0);
    const interestAmount = roundRupees((base * interestRate) / 100);
    return { memberId: member._id, baseAmount: base, interestRate, interestAmount, finalAmount: base + interestAmount, status: "DRAFT" };
  });
};

const distributionMembers = async (cycle) => {
  const participants = await listParticipants(cycle._id);
  const winner = await findWinner(cycle._id);
  const eligible = [];
  for (const participant of participants) {
    if (winner && participant.memberId.toString() === winner.memberId.toString()) continue;
    if (!participant.previousWinnerFlag) {
      const member = await findMember(participant.memberId, cycle.groupId);
      if (member) eligible.push(member);
    }
  }
  return eligible;
};

export const createDistributionDraft = async (cycleId, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  if (!["SETTLED", "DISTRIBUTION_DRAFT"].includes(cycle.status)) throw new AppError("INVALID_STATE", "Settlement must be completed before distribution", 409);
  const existing = await findDistribution(cycle._id);
  if (existing) return toPublic({ distribution: existing, items: await listDistributionItems(existing._id) });
  const group = await findGroupById(cycle.groupId);
  const members = await distributionMembers(cycle);
  const rate = Number(group.rules?.defaultInterestRate || 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError("VALIDATION_ERROR", "Interest rate must be between 0 and 100", 400);
  const sourceAmount = Math.max(0, group.controlledAmount || cycle.remainingAmount || 0);
  const itemInputs = calculateDistribution(members, sourceAmount, rate);
  const distribution = { cycleId: cycle._id, groupId: cycle.groupId, sourceAmount, status: "DRAFT", ruleVersionId: group.activeRuleVersion, totalCalculatedAmount: itemInputs.reduce((sum, item) => sum + item.finalAmount, 0), roundingAdjustment: 0, interestRate: rate, createdBy: userId, createdAt: now(), updatedAt: now() };
  const result = await createDistribution(distribution);
  await createDistributionItems(itemInputs.map((item) => ({ ...item, distributionId: result.insertedId, cycleId: cycle._id, createdAt: now(), updatedAt: now() })));
  await updateCycle(cycle._id, { status: "DISTRIBUTION_DRAFT" });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "DISTRIBUTION_DRAFT_CREATED", entityType: "DISTRIBUTION", entityId: result.insertedId, requestId });
  return toPublic({ distribution: { ...distribution, _id: result.insertedId }, items: await listDistributionItems(result.insertedId) });
};

export const getDistribution = async (cycleId, userId) => {
  const cycle = await ensureCycle(cycleId, userId);
  const distribution = await findDistribution(cycle._id);
  if (!distribution) throw new AppError("NOT_FOUND", "Distribution draft not found", 404);
  return toPublic({ distribution, items: await listDistributionItems(distribution._id) });
};

export const updateDistributionInputs = async (cycleId, body, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  const distribution = await findDistribution(cycle._id);
  if (!distribution) throw new AppError("NOT_FOUND", "Distribution draft not found", 404);
  if (distribution.status !== "DRAFT") throw new AppError("INVALID_STATE", "Published distribution cannot be edited", 409);
  const sourceAmount = body.sourceAmount === undefined ? distribution.sourceAmount : moneyToRupees(body.sourceAmount, "sourceAmount");
  const interestRate = body.interestRate === undefined ? distribution.interestRate : Number(body.interestRate);
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) throw new AppError("VALIDATION_ERROR", "interestRate must be between 0 and 100", 400);
  const members = await distributionMembers(cycle);
  const itemInputs = calculateDistribution(members, sourceAmount, interestRate);
  const database = getDatabase();
  await database.collection("distribution_items").deleteMany({ distributionId: distribution._id });
  await createDistributionItems(itemInputs.map((item) => ({ ...item, distributionId: distribution._id, cycleId: cycle._id, createdAt: now(), updatedAt: now() })));
  const updated = await updateDistribution(cycle._id, { sourceAmount, interestRate, totalCalculatedAmount: itemInputs.reduce((sum, item) => sum + item.finalAmount, 0), roundingAdjustment: 0 });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "DISTRIBUTION_UPDATED", entityType: "DISTRIBUTION", entityId: distribution._id, requestId });
  return toPublic({ distribution: updated.value || updated, items: await listDistributionItems(distribution._id) });
};

export const validateDistribution = async (cycleId, userId) => {
  const result = await getDistribution(cycleId, userId);
  const total = result.items.reduce((sum, item) => sum + item.finalAmount, 0);
  const valid = result.items.length > 0 && result.distribution.sourceAmount >= 0 && total >= 0;
  return { valid, totalCalculatedAmount: roundRupees(total), sourceAmount: roundRupees(result.distribution.sourceAmount), errors: valid ? [] : ["Distribution has no valid items"] };
};

export const publishDistribution = async (cycleId, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  const distribution = await findDistribution(cycle._id);
  if (!distribution) throw new AppError("NOT_FOUND", "Distribution draft not found", 404);
  if (distribution.status === "PUBLISHED") return toPublic({ distribution, items: await listDistributionItems(distribution._id) });
  const validation = await validateDistribution(cycleId, userId);
  if (!validation.valid) throw new AppError("INVALID_STATE", "Distribution validation failed", 409, validation.errors);
  const updated = await updateDistribution(cycle._id, { status: "PUBLISHED", publishedBy: userId, publishedAt: now() });
  await updateCycle(cycle._id, { status: "DISTRIBUTION_PUBLISHED" });
  await createNotification({ recipientUserId: userId, groupId: cycle.groupId, cycleId: cycle._id, type: "DISTRIBUTION_PUBLISHED", title: "Distribution published", body: `Distribution for BHIC ${cycle.bhicNumber} was published`, createdAt: now() });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "DISTRIBUTION_PUBLISHED", entityType: "DISTRIBUTION", entityId: distribution._id, requestId });
  return toPublic({ distribution: updated.value || updated, items: await listDistributionItems(distribution._id) });
};

export const completeBhicCycle = async (cycleId, userId, requestId) => {
  const cycle = await ensureCycle(cycleId, userId);
  if (cycle.status === "COMPLETED") return toPublic(cycle);
  if (cycle.status !== "DISTRIBUTION_PUBLISHED") throw new AppError("INVALID_STATE", "Distribution must be published before completing the cycle", 409);
  const winner = await findWinner(cycle._id);
  const settlement = await findSettlement(cycle._id);
  if (!winner || !settlement) throw new AppError("INVALID_STATE", "Winner settlement is required before completion", 409);
  await getDatabase().collection("group_members").updateOne(
    { _id: winner.memberId },
    { $set: { allocationStatus: "ALLOCATED", updatedAt: now() }, $addToSet: { wonCycleIds: cycle._id } },
  );
  const updated = await updateCycle(cycle._id, { status: "COMPLETED", completedAt: now() });
  await createNotification({ recipientUserId: userId, groupId: cycle.groupId, cycleId: cycle._id, type: "CYCLE_COMPLETED", title: "Cycle completed", body: `BHIC ${cycle.bhicNumber} has been completed`, createdAt: now() });
  await writeAuditLog({ actorType: "MANAGER", actorId: userId, action: "CYCLE_COMPLETED", entityType: "CYCLE", entityId: cycle._id, requestId });
  return toPublic(updated.value || updated);
};

export const getGroupDashboard = async (groupId, userId) => {
  const group = await ensureGroup(groupId, userId);
  const [memberCount, members, cycles, notifications] = await Promise.all([
    countActiveMembers(group._id),
    listMembers(group._id, { membershipStatus: "ACTIVE" }, 0, group.memberLimit),
    listCycles(group._id),
    listNotifications(userId, 0, 5),
  ]);
  const currentCycle = cycles.find((cycle) => !["COMPLETED", "CANCELLED"].includes(cycle.status)) || cycles[cycles.length - 1];
  const loggedInMember = members.find((member) => member.isManager) || members[0] || null;
  const managerFirstName = loggedInMember?.fullName?.trim().split(/\s+/)[0] || null;
  return toPublic({
    group,
    managerName: loggedInMember?.fullName || null,
    managerFirstName,
    loggedInMember,
    totalMembers: memberCount,
    memberCount,
    members,
    startedDate: group.startDate,
    nextDate: currentCycle?.scheduledStart || null,
    currentBhicNumber: currentCycle?.bhicNumber || 0,
    currentCycle,
    recentNotifications: notifications,
  });
};

export const getManagerNotifications = async (userId, query) => {
  const limit = page(query.limit, 20, 100);
  const pageNumber = page(query.page, 1, 1000000);
  const [items, total] = await Promise.all([listNotifications(userId, (pageNumber - 1) * limit, limit), countNotifications(userId)]);
  return { items: toPublic(items), total, page: pageNumber, pageSize: limit, hasNextPage: pageNumber * limit < total };
};

export const readNotification = async (notificationId, userId) => {
  const item = await markNotificationRead(toObjectId(notificationId, "notificationId"), userId);
  if (!item) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return toPublic(item);
};

export const readAllNotifications = async (userId) => { const result = await markAllNotificationsRead(userId); return { modifiedCount: result.modifiedCount }; };

export const queueWhatsAppMessage = async (body, userId, requestId) => {
  const memberId = toObjectId(body.memberId, "memberId");
  const groupId = toObjectId(body.groupId, "groupId");
  await ensureGroup(groupId, userId);
  const messageType = requireString(body.messageType || "GROUP_INFORMATION", "messageType", { min: 3, max: 60 });
  const recipientNumber = normalizeMobileNumber(body.recipientNumber);
  const result = await createWhatsAppMessage({ memberId, groupId, cycleId: body.cycleId ? toObjectId(body.cycleId, "cycleId") : undefined, messageType, templateId: body.templateId || messageType.toLowerCase(), recipientNumber, status: "QUEUED", attemptCount: 0, content: body.content || {}, queuedAt: now(), createdBy: userId, requestId });
  return toPublic({ ...result, _id: result.insertedId });
};
