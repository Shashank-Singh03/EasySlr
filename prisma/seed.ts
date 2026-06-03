/**
 * Seed script — creates demo users, one organization, and one project with memberships so the
 * app is immediately runnable and demoable. Idempotent: safe to run repeatedly (uses upserts).
 *
 * Run with:  pnpm db:seed   (also runs automatically on `prisma migrate reset`)
 *
 * Demo credentials (password is the same for all three): see /docs/decisions/demo-credentials.md
 */
import { hash } from "bcryptjs";

import { PrismaClient, ProjectRole } from "../generated/prisma";

const db = new PrismaClient();

const DEMO_PASSWORD = "password123";

const DEMO_USERS = [
  { email: "owner@demo.test", name: "Olivia Owner", role: ProjectRole.OWNER },
  { email: "reviewer@demo.test", name: "Raj Reviewer", role: ProjectRole.REVIEWER },
  { email: "viewer@demo.test", name: "Vic Viewer", role: ProjectRole.VIEWER },
] as const;

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 10);

  // Users
  const users = await Promise.all(
    DEMO_USERS.map((u) =>
      db.user.upsert({
        where: { email: u.email },
        update: { name: u.name },
        create: { email: u.email, name: u.name, password: passwordHash },
      }),
    ),
  );

  // Organization
  const org = await db.organization.upsert({
    where: { slug: "demo-lab" },
    update: {},
    create: { name: "Demo Research Lab", slug: "demo-lab" },
  });

  // Every demo user is a member of the org.
  await Promise.all(
    users.map((u) =>
      db.organizationMembership.upsert({
        where: { userId_orgId: { userId: u.id, orgId: org.id } },
        update: {},
        create: { userId: u.id, orgId: org.id },
      }),
    ),
  );

  // Project
  const project = await db.project.upsert({
    where: { id: "demo-project-fixed-id" },
    update: {},
    create: {
      id: "demo-project-fixed-id",
      name: "Telehealth Systematic Review",
      orgId: org.id,
    },
  });

  // Project memberships — each demo user gets the role implied by their name.
  await Promise.all(
    users.map((u, i) =>
      db.projectMembership.upsert({
        where: { userId_projectId: { userId: u.id, projectId: project.id } },
        update: { role: DEMO_USERS[i]!.role },
        create: { userId: u.id, projectId: project.id, role: DEMO_USERS[i]!.role },
      }),
    ),
  );

  console.log(
    `Seeded: ${users.length} users, org "${org.name}", project "${project.name}".`,
  );
  console.log(`Demo login: owner@demo.test / ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await db.$disconnect();
    process.exit(1);
  });
