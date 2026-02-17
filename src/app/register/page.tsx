"use client";

import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { BrandMotif } from "@/components/BrandMotif";

// Renders registration form state and account creation UI.
export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Creates a user account and then signs the user in automatically.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Registration failed.");
      return;
    }

    setSuccess("Account created. Signing you in...");
    await signIn("credentials", { email, password, callbackUrl: "/" });
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="card auth-card">
          <BrandMotif />
          <div className="auth-mark">
            <Image
              src="/brand/Chief_Capital_logo.png"
              alt="Chief Capital logo"
              width={281}
              height={64}
              priority
            />
          </div>
          <h1>Create account</h1>
          <small>Set up secure access to your Chief Capital portfolio workspace.</small>
          <form onSubmit={onSubmit}>
            <label>
              Name (optional)
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error ? <small className="tone-negative">{error}</small> : null}
            {success ? <small className="tone-positive">{success}</small> : null}
            <button type="submit">Register</button>
          </form>
          <small>
            Already have an account? <a href="/login">Sign in</a>.
          </small>
        </div>
      </div>
    </div>
  );
}
