"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (result?.error) {
        setState("error");
        setMessage(result.error.message ?? "No fue posible enviar el enlace de recuperación.");
        return;
      }

      setState("sent");
      setMessage("Enlace enviado. Revisa tu correo para definir una nueva contraseña.");
    } catch {
      setState("error");
      setMessage("No fue posible enviar el enlace de recuperación.");
    }
  }

  return (
    <form className="authForm" onSubmit={onSubmit}>
      <label>
        <span>Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.cl"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      {message ? (
        <div className={state === "sent" ? "authSuccessBox" : "authErrorBox"} role="status">
          <strong>{state === "sent" ? "Correo enviado" : "No se pudo completar"}</strong>
          <p>{message}</p>
        </div>
      ) : null}

      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Enviando…" : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
