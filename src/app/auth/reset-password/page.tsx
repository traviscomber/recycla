import { AuthView } from "@neondatabase/auth-ui";
import { RecyclaAuthUI } from "@/components/recycla-auth-ui";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="authPage">
      <section className="authShell">
        <div className="authBrandBlock">
          <p className="eyebrow">RECYCLA REP OS</p>
          <h1>Crear nueva contraseña</h1>
          <p>Define una nueva contraseña y vuelve a ingresar a Recycla.</p>
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
