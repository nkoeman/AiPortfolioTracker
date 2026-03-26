export const dynamic = "force-dynamic";

import { permanentRedirect } from "next/navigation";

export default function RegisterPage() {
  permanentRedirect("/sign-up");
}
