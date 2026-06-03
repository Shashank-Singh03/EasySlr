import { TRPCError } from "@trpc/server";

import { ProjectRole, type PrismaClient } from "../../../generated/prisma";

/**
 * Server-side authorization helpers. These are the single source of truth for "can this user touch
 * this thing?" — the tRPC middleware ladder (see ~/server/api/trpc.ts and /docs/adr/backend/0003)
 * delegates to them, and they're directly tested in test/api.access.test.ts.
 *
 * Convention: "exists but you can't see it" and "doesn't exist" both return NOT_FOUND, so a caller
 * can't probe which IDs exist.
 */
type Db = PrismaClient;

export async function requireOrgMembership(db: Db, userId: string, orgId: string) {
  const membership = await db.organizationMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    include: { org: true },
  });
  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
  }
  return membership.org;
}

export async function requireProjectMembership(
  db: Db,
  userId: string,
  projectId: string,
) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: true },
  });
  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return { project: membership.project, role: membership.role };
}

/**
 * Resolves article → project → membership in a single query, so per-article endpoints never trust
 * a client-supplied articleId without confirming the caller can reach its project.
 */
export async function requireArticleAccess(
  db: Db,
  userId: string,
  articleId: string,
) {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      project: { include: { members: { where: { userId }, select: { role: true } } } },
    },
  });
  if (!article || article.project.members.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });
  }
  return { article, project: article.project, role: article.project.members[0]!.role };
}

/** Writes require more than read access. VIEWER is read-only. */
export function assertCanWrite(role: ProjectRole) {
  if (role === ProjectRole.VIEWER) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You have read-only access to this project",
    });
  }
}

/** Destructive / administrative actions (import, undo) are owner-only. */
export function assertIsOwner(role: ProjectRole) {
  if (role !== ProjectRole.OWNER) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only a project owner can perform this action",
    });
  }
}
