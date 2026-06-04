import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "~/components/app-header";
import { requireSession } from "~/server/auth/require";
import { api } from "~/trpc/server";

import { CreateProject } from "./_components/create-project";

export default async function OrgProjectsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const session = await requireSession();
  const { orgId } = await params;

  // listByOrg throws NOT_FOUND for a non-member; show the 404 page rather than a server error.
  const projects = await api.project.listByOrg({ orgId }).catch(() => null);
  if (!projects) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader userLabel={session.user.name ?? session.user.email ?? "Signed in"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/orgs" className="text-sm text-slate-500 hover:text-slate-900">
          ← Organizations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Projects</h1>

        <div className="mt-6">
          <CreateProject orgId={orgId} />
        </div>

        {projects.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            No projects yet. Create one above, then import articles into it.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{project.name}</span>
                  <span className="text-slate-400">
                    {project._count.articles} article
                    {project._count.articles === 1 ? "" : "s"} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
