import "server-only";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

/**
 * Use at the top of a protected Server Component / page. Redirects to /login when there's no
 * session. (Data access is still re-checked per tRPC call — this is just the UI gate.)
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}
