import Link from "next/link";

import { SignOutButton } from "./sign-out-button";

export function AppHeader({ userLabel }: { userLabel: string }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <Link href="/orgs" className="font-semibold text-slate-900">
        EasySLR
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{userLabel}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
