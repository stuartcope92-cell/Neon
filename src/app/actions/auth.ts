"use server";

import { redirect } from "next/navigation";
import { authenticate, createUser, endSession, startSession } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "/");
  // Only ever redirect within this app — never to an absolute URL from the query string.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { error: "Enter your email and password." };

  let user;
  try {
    user = await authenticate(email, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't sign you in." };
  }

  if (!user) return { error: "Those credentials weren't recognised." };

  await startSession(user);
  redirect(next);
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const signupCode = String(formData.get("signupCode") ?? "");

  if (!email || !password) return { error: "Enter an email address and a password." };
  if (password !== confirmPassword) return { error: "The two passwords don't match." };

  let result;
  try {
    result = await createUser(email, password, signupCode);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't create the account." };
  }

  if ("error" in result) return { error: result.error };

  await startSession(result.user);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
