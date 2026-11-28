import cron from "node-cron";
import { env } from "../config/env.js";
import { getDatabase } from "../db/mongo.js";
import { notifyManagerAndQueueMemberWhatsApp } from "../modules/notifications/notification.service.js";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
let running = false;

const getLocalDateKey = (value, timezone) => {
  const safeTimezone = timezone || DEFAULT_TIMEZONE;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: partValue }) => [type, partValue]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: partValue }) => [type, partValue]));
    return `${values.year}-${values.month}-${values.day}`;
  }
};

const calendarDayDifference = (fromKey, toKey) => {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
};

export const getReminderWindow = (scheduledStart, timezone, currentTime = new Date()) => {
  const todayKey = getLocalDateKey(currentTime, timezone);
  const scheduledKey = getLocalDateKey(scheduledStart, timezone);
  const daysUntilCycle = calendarDayDifference(todayKey, scheduledKey);
  if (daysUntilCycle === 1) return "ONE_DAY_BEFORE";
  if (daysUntilCycle === 0 && new Date(scheduledStart) > new Date(currentTime)) return "SAME_DAY";
  return null;
};

const queueReminder = async (group, cycle, reminderWindow) => {
  const dedupeKey = `CYCLE_REMINDER:${cycle._id.toString()}:${reminderWindow}`;
  const dateLabel = reminderWindow === "ONE_DAY_BEFORE" ? "tomorrow" : "today";
  await notifyManagerAndQueueMemberWhatsApp({
    managerUserId: group.managerId,
    groupId: group._id,
    cycleId: cycle._id,
    type: `CYCLE_REMINDER_${reminderWindow}`,
    title: reminderWindow === "ONE_DAY_BEFORE" ? "Bhishi tomorrow" : "Bhishi today",
    body: `Bhishi ${cycle.bhicNumber} in ${group.name} is scheduled ${dateLabel}`,
    templateId: reminderWindow === "ONE_DAY_BEFORE" ? "cycle-reminder-one-day" : "cycle-reminder-same-day",
    dedupeKey,
    content: {
      groupName: group.name,
      bhishiNumber: cycle.bhicNumber,
      scheduledStart: cycle.scheduledStart,
      contributionAmount: group.contributionAmount,
      reminderWindow,
    },
    createdBy: group.managerId,
  });
};

export const runDueCycleReminderJob = async (currentTime = new Date()) => {
  if (running) return { skipped: true, reason: "previous_run_in_progress" };
  running = true;
  try {
    const database = getDatabase();
    const groups = await database.collection("groups").find({ status: "ACTIVE" }).toArray();
    let queued = 0;
    for (const group of groups) {
      const cycles = await database.collection("cycles").find({ groupId: group._id, status: "SCHEDULED" }).toArray();
      for (const cycle of cycles) {
        const reminderWindow = getReminderWindow(cycle.scheduledStart, group.timezone, currentTime);
        if (!reminderWindow) continue;
        await queueReminder(group, cycle, reminderWindow);
        queued += 1;
      }
    }
    return { groups: groups.length, queued };
  } finally {
    running = false;
  }
};

export const startReminderScheduler = () => {
  if (!env.schedulerEnabled) {
    console.log("[SCHEDULER] Disabled by SCHEDULER_ENABLED=false");
    return { stop: () => {} };
  }
  if (!cron.validate(env.schedulerCron)) throw new Error(`Invalid SCHEDULER_CRON: ${env.schedulerCron}`);
  const task = cron.schedule(env.schedulerCron, async () => {
    try {
      const result = await runDueCycleReminderJob();
      console.log(`[SCHEDULER] Cycle reminders processed ${JSON.stringify(result)}`);
    } catch (error) {
      console.error("[SCHEDULER] Cycle reminder job failed", error);
    }
  });
  console.log(`[SCHEDULER] Cycle reminder scheduler started: ${env.schedulerCron}`);
  return { stop: () => task.stop() };
};
