export const dynamic = "force-dynamic";

import { SignUp } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { authClerkAppearance } from "@/components/auth/clerkAppearance";

export default async function SignUpPage() {
  return (
    <AuthPageShell
      eyebrow="Portfolio intelligence"
      title="Create your account"
      subtitle="Set up your workspace to monitor holdings, contributors, exposures, and transaction-driven performance."
    >
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/app"
        fallbackRedirectUrl="/app"
        appearance={authClerkAppearance}
      />
    </AuthPageShell>
  );
}
