import { AuthView } from "@neondatabase/auth-ui";
import { RecyclaAuthUI } from "@/components/recycla-auth-ui";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="authPage">
      <section className="authShell">
        <div className="authBrandBlock">
          <p className="eyebrow">RECYCLA REP OS</p>
          <h1>Recuperar acceso</h1>
          <p>Ingresa tu correo para recibir el enlace seguro de recuperación.</p>
        </div>
        <section className="authCard authManagedCard">
          <RecyclaAuthUI>
            <AuthView path="forgot-password" />
          </RecyclaAuthUI>
        </section>
      </section>
    </main>
  );
}
