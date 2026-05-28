import dotenv from "dotenv";

dotenv.config();

function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  botToken: getRequired("BOT_TOKEN"),
  databaseUrl: getRequired("DATABASE_URL")
};
