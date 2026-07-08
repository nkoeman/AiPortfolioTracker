export const authClerkAppearance = {
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full",
    card: "w-full border-0 bg-transparent p-0 shadow-none",
    headerTitle: "text-xl font-semibold tracking-tight text-text",
    headerSubtitle: "text-sm leading-6 text-muted",
    formFieldLabel: "text-sm font-medium text-text-2",
    formFieldInput: "h-11 rounded-xl border-border px-3 text-sm",
    formButtonPrimary: "h-11 rounded-xl bg-accent text-sm font-medium text-white hover:brightness-110",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-border bg-surface text-sm font-medium text-text hover:bg-surface-2",
    socialButtonsBlockButtonText: "text-sm font-medium text-text",
    dividerText: "text-xs text-muted",
    footerActionLink: "font-medium text-accent hover:brightness-110"
  }
};
