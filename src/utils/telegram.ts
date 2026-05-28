import type { User } from "grammy/types";

export function getDisplayName(user: User): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) return fullName;
  if (user.username) return `@${user.username}`;
  return "Intern";
}
