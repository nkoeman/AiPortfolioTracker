export const dynamic = "force-dynamic";

import { SignIn } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { authClerkAppearance } from "@/components/auth/clerkAppearance";

export default async function SignInPage() {
  return (
    <AuthPageShell
      eyebrow="Portfolio intelligence"
      title="Welcome back"
      subtitle="Sign in to track performance, exposures, transactions, and portfolio insights in one place."
    >
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/app"
        fallbackRedirectUrl="/app"
        appearance={authClerkAppearance}
      />
    </AuthPageShell>
  );
}
