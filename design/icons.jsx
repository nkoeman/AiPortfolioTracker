// SVG icon set for ETFMinded redesign
const Icon = ({ name, size = 16, stroke = 1.6, ...rest }) => {
  const s = { width: size, height: size, fill: "none", stroke: "currentColor",
    strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "performance":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M3 17l5-5 4 4 8-9"/><path d="M14 7h6v6"/></svg>;
    case "portfolio":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M3 9.5L12 4l9 5.5"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/></svg>;
    case "transactions":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M4 7h12l-3-3"/><path d="M20 17H8l3 3"/></svg>;
    case "insights":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "bell":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    case "moon":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z"/></svg>;
    case "plus":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M12 5v14M5 12h14"/></svg>;
    case "upload":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>;
    case "refresh":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 21v-5h5"/></svg>;
    case "sparkles":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.6l-1.8-4.5L6 9.3l4.2-1.8z"/><path d="M19 15l.8 1.8 1.8.8-1.8.8L19 20l-.8-1.6-1.8-.8 1.8-.8z"/></svg>;
    case "chevron-down":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M6 9l6 6 6-6"/></svg>;
    case "info":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>;
    case "external":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M14 4h6v6"/><path d="M10 14L20 4"/><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/></svg>;
    case "filter":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M3 4h18l-7 9v6l-4 2v-8z"/></svg>;
    case "download":
      return <svg viewBox="0 0 24 24" {...s} {...rest}><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 19h16"/></svg>;
    default: return null;
  }
};

window.Icon = Icon;
