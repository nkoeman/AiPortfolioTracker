import { permanentRedirect } from "next/navigation";

export default function LegacyPortfolioRedirectPage() {
  permanentRedirect("/app/portfolio");
}
