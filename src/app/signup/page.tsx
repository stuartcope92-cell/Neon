import SignupForm from "@/components/SignupForm";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

export const metadata = { title: "Create account · Neon Quote Creator" };

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="neon-text text-3xl font-bold tracking-tight">Neon Quote Creator</h1>
          <p className="mt-2 text-sm text-muted">
            Create a login. You&rsquo;ll share the same quotes, customers and prices as everyone
            else on the account.
          </p>
        </div>
        <SignupForm minPasswordLength={MIN_PASSWORD_LENGTH} />
      </div>
    </main>
  );
}
