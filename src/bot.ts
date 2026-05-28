import { Bot, Context, session, SessionFlavor } from "grammy";
import { hydrate, HydrateFlavor } from "@grammyjs/hydrate";
import { env } from "./config/env";
import { extractTextFromImageBuffer } from "./services/ocrService";
import { getLeaderboard, getMySubmission, upsertUserAndSubmission } from "./services/submissionService";
import { PendingManualEntry, BotSession } from "./types/session";
import { formatMonthYear, formatTimestamp, getMonthYear } from "./utils/date";
import { parseBalance, parseManualBalance } from "./utils/balanceParser";
import { getDisplayName } from "./utils/telegram";

type AppContext = HydrateFlavor<Context> & SessionFlavor<BotSession>;

function initialSession(): BotSession {
  return { awaitingManualBalance: null };
}

function toLeaderboardName(user: { firstName: string | null; lastName: string | null; username: string | null }): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  return "Intern";
}

function leaderboardText(
  rows: Array<{
    balance: unknown;
    updatedAt: Date;
    user: { firstName: string | null; lastName: string | null; username: string | null };
  }>,
  month: number,
  year: number
): string {
  const title = `HMGICS Meal Credits Leaderboard - ${formatMonthYear(month, year)}`;
  if (rows.length === 0) {
    return `${title}\n\nNo submissions yet. Upload your wallet screenshot with /submit to join the race.`;
  }

  const lines = rows.map((entry, idx) => {
    const balance = Number(entry.balance);
    return `${idx + 1}. ${toLeaderboardName(entry.user)} - $${balance.toFixed(2)} (updated ${formatTimestamp(entry.updatedAt)})`;
  });

  return `${title}\n\n${lines.join("\n")}`;
}

async function getImageBufferFromTelegram(ctx: AppContext, fileId: string): Promise<Buffer> {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) {
    throw new Error("Unable to retrieve Telegram file path.");
  }

  const url = `https://api.telegram.org/file/bot${env.botToken}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from Telegram: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function saveSubmissionFromBalance(
  ctx: AppContext,
  pending: PendingManualEntry,
  balance: number
): Promise<void> {
  const from = ctx.from;
  if (!from) {
    throw new Error("No Telegram user context found.");
  }

  const submission = await upsertUserAndSubmission({
    telegramUser: from,
    month: pending.month,
    year: pending.year,
    balance,
    screenshotFileId: pending.screenshotFileId,
    rawOcrText: pending.rawOcrText
  });

  const name = getDisplayName(from);
  await ctx.reply(
    `Nice, ${name}! Your latest balance for ${formatMonthYear(submission.month, submission.year)} is $${Number(submission.balance).toFixed(2)}.`
  );
}

export function createBot() {
  const bot = new Bot<AppContext>(env.botToken);

  bot.use(session({ initial: initialSession }));
  bot.use(hydrate());

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hey! I am the HMGICS Meal Credits Leaderboard bot.\n\n" +
        "Upload your meal wallet screenshot each month and I will track your latest remaining balance.\n" +
        "For privacy, please crop out your payment QR code before uploading.\n" +
        "Lowest remaining balance wins at month-end.\n" +
        "Open to all HMGICS employees.\n\n" +
        "Commands:\n" +
        "/submit - submit a screenshot\n" +
        "/leaderboard - current month ranking\n" +
        "/me - your latest entry\n" +
        "/help - command list"
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Available commands:\n" +
        "/start - intro and instructions\n" +
        "/submit - upload your wallet screenshot\n" +
        "/leaderboard - show current month standings\n" +
        "/me - show your latest submitted balance\n" +
        "/help - show this help message"
    );
  });

  bot.command("submit", async (ctx) => {
    ctx.session.awaitingManualBalance = null;
    await ctx.reply(
      "Send a cropped screenshot that includes only your remaining meal credits amount.\n\n" +
        "Important: crop out the payment QR code and lower section for privacy.\n" +
        "Tip: include just the top section with the balance text for better OCR accuracy."
    );
  });

  bot.command("leaderboard", async (ctx) => {
    const { month, year } = getMonthYear();
    const rows = await getLeaderboard(month, year);
    await ctx.reply(leaderboardText(rows, month, year));
  });

  bot.command("me", async (ctx) => {
    if (!ctx.from) return;
    const { month, year } = getMonthYear();
    const submission = await getMySubmission(String(ctx.from.id), month, year);

    if (!submission) {
      await ctx.reply(`No submission found for ${formatMonthYear(month, year)} yet. Use /submit to upload one.`);
      return;
    }

    await ctx.reply(
      `Your latest balance for ${formatMonthYear(month, year)} is $${Number(submission.balance).toFixed(2)} (updated ${formatTimestamp(submission.updatedAt)}).`
    );
  });

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;

    const photoSizes = ctx.message.photo;
    const bestPhoto = photoSizes[photoSizes.length - 1];
    const screenshotFileId = bestPhoto.file_id;
    const { month, year } = getMonthYear();

    await ctx.reply("Reading your screenshot... one sec!");

    try {
      const imageBuffer = await getImageBufferFromTelegram(ctx, screenshotFileId);
      const ocr = await extractTextFromImageBuffer(imageBuffer);
      const parsedBalance = parseBalance(ocr.text);

      if (ocr.confidence < 55 || parsedBalance === null) {
        ctx.session.awaitingManualBalance = {
          month,
          year,
          screenshotFileId,
          rawOcrText: ocr.text
        };

        await ctx.reply(
          "I could not confidently read your balance from this screenshot. " +
            "Please reply with your balance manually (example: 12.40), " +
            "or upload a tighter crop that shows only the balance area (without QR code)."
        );
        return;
      }

      await saveSubmissionFromBalance(
        ctx,
        {
          month,
          year,
          screenshotFileId,
          rawOcrText: ocr.text
        },
        parsedBalance
      );
    } catch (error) {
      console.error("Failed to process screenshot", error);
      await ctx.reply("Oops, I could not process that screenshot. Please try again or submit your balance manually.");
    }
  });

  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.awaitingManualBalance;
    if (!pending) return;

    const value = parseManualBalance(ctx.message.text);
    if (value === null) {
      await ctx.reply("I could not parse that amount. Please send a number between 0 and 250, like 45.20.");
      return;
    }

    await saveSubmissionFromBalance(ctx, pending, value);
    ctx.session.awaitingManualBalance = null;
  });

  bot.catch((error) => {
    console.error("Bot error:", error);
  });

  return bot;
}
