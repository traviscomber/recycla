import Link from "next/link";
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
    const code =
      "code" in error && error.code
        ? String(error.code)
        : "status" in error && error.status
          ? String(error.status)
          : "unknown";
    const source =
      process.env.VERCEL_ENV === "preview"
        ? "canonical-preview"
        : process.env.NEON_AUTH_BASE_URL
          ? "env"
          : "fallback";
    redirect(`/auth/sign-in?error=invalid&authCode=${encodeURIComponent(code)}&authSource=${source}`);
  }

  redirect("/");
}

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; authCode?: string; authSource?: string }>;
}) {
  const params = await searchParams;
  const configured = isAuthConfigured();

  const message =
    params.error === "invalid"
      ? "No fue posible ingresar. Si es tu primer acceso o aún no tienes contraseña, define una ahora."
      : params.error === "missing"
        ? "Ingresa correo y contraseña."
        : params.error === "not-configured"
          ? "La autenticación no está disponible en este entorno."
          : null;

  return (
    <main className="authPage">
      <section className="authShell">
        <div className="authBrandBlock">
          <p className="eyebrow">RECYCLA REP OS</p>
          <h1>Ingresar a Recycla</h1>
          <p>
            Acceso interno para operación, evidencia y cierre REP.
          </p>
        </div>

        <section className="authCard authCardPrimary">
          <div className="authCardHead">
            <span>Acceso interno</span>
            <h2>Ingresar</h2>
            <p>Usa tu correo y contraseña asignados.</p>
          </div>

          {!configured ? (
            <div className="systemNotice notice-schema_missing">
              <div>
                <strong>Acceso temporalmente no disponible</strong>
                <p>La configuración de autenticación requiere revisión.</p>
              </div>
            </div>
          ) : (
            <form action={signInAction} className="authForm">
              <label>
                <span>Correo</span>
                <input name="email" type="email" autoComplete="email" placeholder="nombre@empresa.cl" required />
              </label>
              <label>
                <span>Contraseña</span>
                <input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
              </label>

              {message ? (
                <div className="authErrorBox">
                  <strong>Acceso no completado</strong>
                  <p>{message}</p>
                  {params.authCode ? (
                    <small>Diagnóstico: {params.authCode} · auth {params.authSource ?? "unknown"}</small>
                  ) : null}
                </div>
              ) : null}

              <button type="submit">Ingresar</button>
            </form>
          )}

          <div className="authRecovery">
            <span>¿Primer acceso o contraseña olvidada?</span>
            <Link href="/auth/forgot-password">Definir o recuperar contraseña →</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
