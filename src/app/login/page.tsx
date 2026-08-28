import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in · Neon Quote Creator" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="neon-text text-3xl font-bold tracking-tight">Neon Quote Creator</h1>
          <p className="mt-2 text-sm text-muted">Sign in to build and track quotes.</p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
