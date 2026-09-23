import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";
import { RecyclaAuthUI } from "@/components/recycla-auth-ui";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="authPage">
      <section className="authCard">
        <p className="eyebrow">RECYCLA REP OS</p>
        <RecyclaAuthUI>
          <AuthView path={path} />
        </RecyclaAuthUI>
      </section>
    </main>
  );
}
