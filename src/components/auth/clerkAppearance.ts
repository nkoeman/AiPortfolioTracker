export const authClerkAppearance = {
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full",
    card: "w-full border-0 bg-transparent p-0 shadow-none",
    headerTitle: "text-xl font-semibold tracking-tight text-slate-900",
    headerSubtitle: "text-sm leading-6 text-slate-600",
    formFieldLabel: "text-sm font-medium text-slate-700",
    formFieldInput: "h-11 rounded-xl border-slate-300 px-3 text-sm",
    formButtonPrimary:
      "h-11 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 focus-visible:ring-slate-400",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50",
    socialButtonsBlockButtonText: "text-sm font-medium text-slate-800",
    dividerText: "text-xs text-slate-500",
    footerActionLink: "font-medium text-slate-900 hover:text-slate-700"
  }
};
