type ResponsiveChartProps = {
  children: React.ReactNode;
};

// Shared responsive chart frame used by chart components.
export function ResponsiveChart({ children }: ResponsiveChartProps) {
  return <div className="responsive-chart">{children}</div>;
}

