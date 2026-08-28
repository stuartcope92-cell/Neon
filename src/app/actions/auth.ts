"use server";

import { redirect } from "next/navigation";
import { authenticate, endSession, startSession } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) return { error: "Enter your email and password." };

  let ok = false;
  try {
    ok = await authenticate(email, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Login is not configured." };
  }

  if (!ok) return { error: "Those credentials weren't recognised." };

  await startSession(email);
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
