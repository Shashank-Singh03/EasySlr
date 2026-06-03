import Link from "next/link";

import { auth } from "~/server/auth";

/**
 * Landing page. The real workspace lives under /orgs (built in a later step). This is a thin
 * entry point that points signed-in users at their organizations and everyone else at login.
 */
export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 p-8 text-slate-900">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight">EasySLR</h1>
        <p className="mt-2 text-slate-600">
          Import research articles into a project and review them in a
          table-driven workflow.
        </p>
      </div>

      <Link
        href={session?.user ? "/orgs" : "/login"}
        className="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700"
      >
        {session?.user ? "Go to workspace" : "Sign in"}
      </Link>
    </main>
  );
}
