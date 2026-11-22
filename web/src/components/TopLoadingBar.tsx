import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Client-side navigation here is instant (no network round trip), so this
// isn't tracking a real "page is loading" signal - it's a deliberate, short
// (matches the CSS fill animation) cue that something happened, so a route
// change reads as a navigation rather than the page silently swapping
// content under the user. Skipped on the very first render (no transition
// away from a blank page) and whenever prefers-reduced-motion is set.
export function TopLoadingBar() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setVisible(true);
    const hide = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(hide);
  }, [location.pathname]);

  if (!visible) return null;
  return <div className="top-loading-bar" aria-hidden="true" />;
}
