import "server-only";
import { cookies } from "next/headers";
import { apiRequest, unwrapUser } from "@/lib/api-client";
import type { User } from "@/types";

/**
 * Authenticated server components can use this helper to forward the browser's
 * HTTP-only session cookie to NestJS. Public event pages do not require it.
 */
export async function serverCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const result = await apiRequest<User | { user: User }>("/auth/me", {
    headers: { Cookie: cookieStore.toString() },
    cache: "no-store"
  });
  return unwrapUser(result);
}
