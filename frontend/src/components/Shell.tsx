import type { ReactNode } from "react";

/**
 * The framed column: a whiter surface on the near-white ground with a 1px hairline down each
 * side, running the full page height. That vertical framing is the identity of the design, so it
 * wraps every page including the app.
 */
export function Shell({ children, docs = false }: { children: ReactNode; docs?: boolean }) {
  return <div className={`col${docs ? " docs-shell" : ""}`}>{children}</div>;
}

export function In({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`in ${className}`.trim()}>{children}</div>;
}

export function Section({
  children,
  className = "",
  id,
  small = false,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  small?: boolean;
}) {
  return (
    <section id={id} className={`in ${small ? "sec-sm" : "sec"} ${className}`.trim()}>
      {children}
    </section>
  );
}

export function Rule() {
  return <hr className="rule" />;
}
