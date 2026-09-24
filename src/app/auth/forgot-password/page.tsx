import Link from "next/link";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="authPage">
      <section className="authShell">
        <div className="authBrandBlock">
          <p className="eyebrow">RECYCLA REP OS</p>
          <h1>Recuperar contraseña</h1>
          <p>Te enviaremos un enlace para definir una nueva contraseña.</p>
        </div>
        <section className="authCard authCardPrimary">
          <div className="authCardHead">
            <span>Recuperación</span>
            <h2>Ingresa tu correo</h2>
            <p>Usa el correo asociado a tu acceso interno.</p>
          </div>

          <PasswordRecoveryForm />

          <div className="authRecovery">
            <Link href="/auth/sign-in">← Volver al acceso</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
