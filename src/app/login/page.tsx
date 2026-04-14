export const dynamic = "force-dynamic";

import { permanentRedirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: {
    callbackUrl?: string;
    redirect_url?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callback = searchParams?.redirect_url || searchParams?.callbackUrl || "/app";
  permanentRedirect(`/sign-in?redirect_url=${encodeURIComponent(callback)}`);
}
