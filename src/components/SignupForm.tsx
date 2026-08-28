"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signupAction } from "@/app/actions/auth";
import type { ActionState } from "@/lib/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export default function SignupForm({ minPasswordLength }: { minPasswordLength: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(signupAction, {});
  // React 19 resets the form after an action runs, which would wipe the email on
  // every validation error. Controlling it keeps what they typed.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="field"
          placeholder="you@yourcompany.co.uk"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          className="field"
        />
        <p className="mt-1 text-xs text-muted">At least {minPasswordLength} characters.</p>
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="signupCode">
          Signup code
        </label>
        <input
          id="signupCode"
          name="signupCode"
          type="text"
          required
          className="field"
          placeholder="From whoever runs the account"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
