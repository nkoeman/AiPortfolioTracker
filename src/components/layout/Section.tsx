type SectionProps = {
  children: React.ReactNode;
  className?: string;
};

// Vertical spacing primitive for page sections.
export function Section({ children, className }: SectionProps) {
  return <section className={`page-section${className ? ` ${className}` : ""}`}>{children}</section>;
}

