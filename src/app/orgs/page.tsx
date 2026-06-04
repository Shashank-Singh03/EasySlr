import Link from "next/link";

import { AppHeader } from "~/components/app-header";
import { requireSession } from "~/server/auth/require";
import { api } from "~/trpc/server";

import { CreateOrg } from "./_components/create-org";

export default async function OrgsPage() {
  const session = await requireSession();
  const orgs = await api.org.listMine();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader userLabel={session.user.name ?? session.user.email ?? "Signed in"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Organizations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick an organization to see its projects.
        </p>

        <div className="mt-6">
          <CreateOrg />
        </div>

        {orgs.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            You have no organizations yet. Create one above to get started.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/orgs/${org.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{org.name}</span>
                  <span className="text-slate-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
