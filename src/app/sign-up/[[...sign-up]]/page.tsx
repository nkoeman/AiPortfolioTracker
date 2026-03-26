export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { authClerkAppearance } from "@/components/auth/clerkAppearance";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

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
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        appearance={authClerkAppearance}
      />
    </AuthPageShell>
  );
}
