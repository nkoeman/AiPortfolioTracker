export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { authClerkAppearance } from "@/components/auth/clerkAppearance";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

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
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        appearance={authClerkAppearance}
      />
    </AuthPageShell>
  );
}
