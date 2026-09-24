"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import "@neondatabase/auth-ui/css";
import { authClient } from "@/lib/auth/client";

export function RecyclaAuthUI({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      credentials={{ forgotPassword: true }}
      localization={{
        SIGN_IN: "Ingresar",
        SIGN_IN_DESCRIPTION: "Ingresa a tu cuenta para continuar",
        SIGN_UP: "Crear cuenta",
        SIGN_UP_DESCRIPTION: "Crear una nueva cuenta",
        FORGOT_PASSWORD: "Recuperar contraseña",
        FORGOT_PASSWORD_DESCRIPTION: "Ingresa tu correo para recibir un enlace de recuperación",
        RESET_PASSWORD: "Definir contraseña",
        RESET_PASSWORD_DESCRIPTION: "Ingresa tu nueva contraseña",
        SIGN_IN_ACTION: "Ingresar",
        SIGN_UP_ACTION: "Continuar",
        FORGOT_PASSWORD_ACTION: "Enviar enlace de recuperación",
        RESET_PASSWORD_ACTION: "Guardar nueva contraseña",
        DONT_HAVE_AN_ACCOUNT: "¿No tienes cuenta?",
        ALREADY_HAVE_AN_ACCOUNT: "¿Ya tienes una cuenta?",
        REQUEST_FAILED: "No fue posible completar la solicitud. Intenta nuevamente.",
        OR_CONTINUE_WITH: "O continúa con",
        SIGN_IN_WITH: "Continuar con"
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
