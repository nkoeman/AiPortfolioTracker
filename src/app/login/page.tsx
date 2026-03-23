"use client";

import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { BrandMotif } from "@/components/BrandMotif";

// Renders login form state and resolves callback navigation.
export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Submits credentials through NextAuth and handles auth errors.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: true
    });
    if (res?.error) setError("Invalid email or password.");
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
          <form onSubmit={onSubmit}>
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
            <button type="submit">Login</button>
          </form>
          <small>
            New here? <a href="/register">Create an account</a>.
          </small>
        </div>
      </div>
    </div>
  );
}
