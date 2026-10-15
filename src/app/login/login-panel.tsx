"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

type FormState = { error?: string } | null;

export function LoginPanel({ login }: { login: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form
      action={action}
      className="max-w-sm space-y-5 rounded-card border border-line bg-surface p-8 card-shadow"
    >
      <Field label="Username">
        <Input name="username" autoComplete="username" required placeholder="admin" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error ? <p className="text-xs text-redtext">{state.error}</p> : null}
      <Button className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
