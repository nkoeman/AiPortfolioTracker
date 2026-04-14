import { permanentRedirect } from "next/navigation";

export default function LegacyImportRedirectPage() {
  permanentRedirect("/app/import");
}
