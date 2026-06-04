import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "~/components/app-header";
import { requireSession } from "~/server/auth/require";
import { api } from "~/trpc/server";

import { Workspace } from "./_components/workspace";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireSession();
  const { projectId } = await params;

  // get() throws NOT_FOUND for a non-member; render the 404 page instead of a server error.
  const project = await api.project.get({ projectId }).catch(() => null);
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader userLabel={session.user.name ?? session.user.email ?? "Signed in"} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href={`/orgs/${project.orgId}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Projects
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {project.role}
          </span>
        </div>

        <div className="mt-6">
          <Workspace projectId={projectId} projectName={project.name} role={project.role} />
        </div>
      </main>
    </div>
  );
}
