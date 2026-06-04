"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

export function CreateOrg() {
  const router = useRouter();
  const [name, setName] = useState("");
  const create = api.org.create.useMutation({
    onSuccess: () => {
      setName("");
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) create.mutate({ name: name.trim() });
      }}
      className="flex gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New organization name"
        className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={create.isPending || !name.trim()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
      >
        {create.isPending ? "Creating…" : "Create"}
      </button>
      {create.error && (
        <span role="alert" className="self-center text-sm text-red-600">
          {create.error.message}
        </span>
      )}
    </form>
  );
}
