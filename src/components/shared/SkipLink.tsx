"use client";

/**
 * Visually-hidden "Skip to content" link — the first focusable element on
 * every page (mounted in the root layout). Keyboard / switch / VoiceOver
 * users tab to it once and jump past the sticky header + nav.
 *
 * Targets `#main`. Pages Claude owns (harvest, receiver, about, login,
 * signup) set id="main" on their <main>; the chef and admin layouts don't
 * carry an id yet, so on click we fall back to the first <main> landmark on
 * the page and focus it programmatically (tabindex=-1 so it can take focus
 * without entering the tab order). The href keeps working without JS
 * wherever the id exists.
 */
export function SkipLink() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const target =
      document.getElementById("main") ??
      document.querySelector<HTMLElement>("main, [role='main']");
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  return (
    <a
      href="#main"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-farm-green focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
    >
      Skip to content
    </a>
  );
}
