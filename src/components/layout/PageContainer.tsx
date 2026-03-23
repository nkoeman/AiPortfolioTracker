type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

// Standard responsive page wrapper used across app pages.
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={`page-container${className ? ` ${className}` : ""}`}>{children}</div>;
}

