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
        SIGN_UP: "Crear cuenta",
        FORGOT_PASSWORD: "Olvidé mi contraseña"
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
