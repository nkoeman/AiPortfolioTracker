type AppRouteLoadingProps = {
  title?: string;
};

export function AppRouteLoading({ title = "Loading" }: AppRouteLoadingProps) {
  return (
    <div className="page-container">
      <div className="page-stack">
        <div className="page-head">
          <div>
            <h1 className="page-title">{title}</h1>
          </div>
        </div>
        <div className="loading-grid">
          <div className="card loading-card loading-card-large">
            <span className="skeleton skeleton-label" />
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-chart" />
          </div>
          <div className="card loading-card">
            <span className="skeleton skeleton-label" />
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line short" />
          </div>
        </div>
      </div>
    </div>
  );
}
