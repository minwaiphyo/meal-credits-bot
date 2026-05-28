import type { User as TgUser } from "grammy/types";
import { prisma } from "../db/prisma";

type SaveSubmissionInput = {
  telegramUser: TgUser;
  month: number;
  year: number;
  balance: number;
  screenshotFileId: string;
  rawOcrText: string;
};

export async function upsertUserAndSubmission(input: SaveSubmissionInput) {
  const user = await prisma.user.upsert({
    where: { telegramId: String(input.telegramUser.id) },
    update: {
      username: input.telegramUser.username ?? null,
      firstName: input.telegramUser.first_name ?? null,
      lastName: input.telegramUser.last_name ?? null
    },
    create: {
      telegramId: String(input.telegramUser.id),
      username: input.telegramUser.username ?? null,
      firstName: input.telegramUser.first_name ?? null,
      lastName: input.telegramUser.last_name ?? null
    }
  });

  return prisma.submission.upsert({
    where: {
      userId_month_year: {
        userId: user.id,
        month: input.month,
        year: input.year
      }
    },
    update: {
      balance: input.balance,
      screenshotFileId: input.screenshotFileId,
      rawOcrText: input.rawOcrText
    },
    create: {
      userId: user.id,
      month: input.month,
      year: input.year,
      balance: input.balance,
      screenshotFileId: input.screenshotFileId,
      rawOcrText: input.rawOcrText
    },
    include: { user: true }
  });
}

export async function getLeaderboard(month: number, year: number) {
  return prisma.submission.findMany({
    where: { month, year },
    include: { user: true },
    orderBy: [{ balance: "asc" }, { updatedAt: "asc" }]
  });
}

export async function getMySubmission(telegramId: string, month: number, year: number) {
  return prisma.submission.findFirst({
    where: {
      month,
      year,
      user: { telegramId }
    },
    include: { user: true }
  });
}
