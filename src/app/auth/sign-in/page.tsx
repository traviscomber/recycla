import { redirect } from "next/navigation";
import { getAuthServer, isAuthConfigured } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

async function signInAction(formData: FormData) {
  "use server";

  if (!isAuthConfigured()) {
    redirect("/auth/sign-in?error=not-configured");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/auth/sign-in?error=missing");
  }

  const { error } = await getAuthServer().signIn.email({ email, password });

  if (error) {
    redirect("/auth/sign-in?error=invalid");
  }

  redirect("/");
}

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configured = isAuthConfigured();

  const message =
    params.error === "invalid"
      ? "Credenciales inválidas."
      : params.error === "missing"
        ? "Email y contraseña son requeridos."
        : params.error === "not-configured"
          ? "Autenticación todavía no está provisionada en este entorno."
          : null;

  return (
    <main className="authPage">
      <section className="authCard">
        <p className="eyebrow">RECYCLA REP OS</p>
        <h1>Acceso operacional</h1>
        <p className="muted">
          El acceso y las acciones regulatorias se controlan mediante sesión y rol.
        </p>

        {!configured ? (
          <div className="systemNotice notice-schema_missing">
            <div>
              <strong>Auth no configurado</strong>
              <p>Este entorno requiere NEON_AUTH_BASE_URL y NEON_AUTH_COOKIE_SECRET.</p>
            </div>
          </div>
        ) : (
          <form action={signInAction} className="authForm">
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {message ? <p className="authError">{message}</p> : null}
            <button type="submit">Ingresar</button>
          </form>
        )}
      </section>
    </main>
  );
}
