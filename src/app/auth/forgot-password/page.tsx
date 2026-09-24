import Link from "next/link";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";

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
        <section className="authCard authCardPrimary">
          <div className="authCardHead">
            <span>Cuenta autorizada</span>
            <h2>Recuperar contraseña</h2>
            <p>El enlace volverá a Recycla para definir una nueva contraseña.</p>
          </div>

          <PasswordRecoveryForm />

          <div className="authRecovery">
            <Link href="/auth/sign-in">← Volver a ingresar</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
