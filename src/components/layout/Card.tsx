type CardProps = {
  children: React.ReactNode;
  className?: string;
};

// Unified card primitive with responsive spacing.
export function Card({ children, className }: CardProps) {
  return <div className={`card app-card${className ? ` ${className}` : ""}`}>{children}</div>;
}

