import { createBot } from "./bot";
import { prisma } from "./db/prisma";

async function main() {
  const bot = createBot();
  await bot.start();
  console.log("Intern Meal Credits Leaderboard bot is running.");
}

main().catch(async (error) => {
  console.error("Fatal startup error:", error);
  await prisma.$disconnect();
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
