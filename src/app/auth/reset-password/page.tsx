import { AuthView } from "@neondatabase/auth-ui";
import { RecyclaAuthUI } from "@/components/recycla-auth-ui";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="authPage">
      <section className="authShell">
        <div className="authBrandBlock">
          <p className="eyebrow">RECYCLA REP OS</p>
          <h1>Definir contraseña</h1>
          <p>Crea una nueva contraseña para activar tu acceso operacional.</p>
        </div>
        <section className="authCard authManagedCard">
          <RecyclaAuthUI>
            <AuthView path="reset-password" />
          </RecyclaAuthUI>
        </section>
      </section>
    </main>
  );
}
