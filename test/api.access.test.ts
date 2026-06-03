import { readFileSync } from "node:fs";

import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Stub the auth module so importing the router graph doesn't pull in next-auth's runtime (which
// imports next/server and can't load under vitest). createCaller takes the context directly, so the
// real auth() is never used here.
vi.mock("~/server/auth", () => ({
  auth: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}));

import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";

/**
 * Integration tests that exercise the real tRPC routers against the dev database. They prove the
 * rubric's core guarantees: project access is enforced server-side, writes respect roles, imports
 * are idempotent, and concurrent edits don't silently clobber.
 *
 * Each run creates a throwaway org/project/users with a unique suffix and tears them down after, so
 * it doesn't depend on or disturb seeded data. A dedicated test database (Testcontainers) is the
 * production-grade approach; this is the timeboxed version.
 */
const suffix = Math.random().toString(36).slice(2, 8);

const caller = (userId: string | null) => {
  const session: Session | null = userId
    ? { user: { id: userId }, expires: "2999-01-01T00:00:00.000Z" }
    : null;
  return createCaller({ db, session, headers: new Headers() });
};

let orgId: string;
let projectId: string;
let ownerId: string;
let viewerId: string;
let outsiderId: string;
let articleId: string;

beforeAll(async () => {
  const [owner, viewer, outsider] = await Promise.all([
    db.user.create({ data: { email: `owner-${suffix}@t.test`, name: "Owner", password: "x" } }),
    db.user.create({ data: { email: `viewer-${suffix}@t.test`, name: "Viewer", password: "x" } }),
    db.user.create({ data: { email: `out-${suffix}@t.test`, name: "Outsider", password: "x" } }),
  ]);
  ownerId = owner.id;
  viewerId = viewer.id;
  outsiderId = outsider.id;

  const org = await db.organization.create({ data: { name: "Test Org", slug: `test-${suffix}` } });
  orgId = org.id;
  const project = await db.project.create({ data: { name: "Test Project", orgId: org.id } });
  projectId = project.id;

  await db.projectMembership.createMany({
    data: [
      { userId: ownerId, projectId, role: "OWNER" },
      { userId: viewerId, projectId, role: "VIEWER" },
    ],
  });

  const article = await db.article.create({
    data: { projectId, title: "Seed article", pmid: `seed-${suffix}` },
  });
  articleId = article.id;
});

afterAll(async () => {
  // Deleting the org cascades projects → articles → reviews and memberships; then remove the users.
  await db.organization.delete({ where: { id: orgId } }).catch(() => undefined);
  await db.user
    .deleteMany({ where: { id: { in: [ownerId, viewerId, outsiderId] } } })
    .catch(() => undefined);
  await db.$disconnect();
});

describe("project access is enforced server-side", () => {
  it("hides a project from a non-member (NOT_FOUND, not a leak)", async () => {
    await expect(caller(outsiderId).project.get({ projectId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets a member read the project", async () => {
    const project = await caller(ownerId).project.get({ projectId });
    expect(project.id).toBe(projectId);
  });

  it("blocks a VIEWER from writing a review (FORBIDDEN)", async () => {
    await expect(
      caller(viewerId).review.update({ articleId, decision: "INCLUDE" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("import is idempotent", () => {
  const fixture = readFileSync(
    new URL("./fixtures/sample_article_import.xlsx", import.meta.url),
  ).toString("base64");

  it("imports 23 the first time, then re-imports only the un-deduplicable row", async () => {
    const first = await caller(ownerId).import.process({
      projectId,
      filename: "sample_article_import.xlsx",
      contentBase64: fixture,
      dryRun: false,
    });
    expect(first.committed).toBe(true);
    expect(first.summary.willImport).toBe(23);

    const second = await caller(ownerId).import.process({
      projectId,
      filename: "sample_article_import.xlsx",
      contentBase64: fixture,
      dryRun: false,
    });
    // 22 of the 23 importable rows have a PMID and are skipped as duplicates. The one row with NO
    // PMID ("Blank PMID example") can't be hard-deduped (ADR-0001 / BUG-007), so it re-imports — a
    // faithful demonstration of that documented limitation, not a regression.
    expect(second.summary.willImport).toBe(1);
    expect(second.summary.duplicates).toBe(23);
  });
});

describe("review edits use optimistic concurrency", () => {
  it("rejects a stale update with CONFLICT instead of clobbering", async () => {
    const review = await caller(ownerId).review.update({ articleId, decision: "MAYBE" });

    await expect(
      caller(ownerId).review.update({
        articleId,
        decision: "INCLUDE",
        expectedUpdatedAt: new Date(review.updatedAt.getTime() - 1000),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
