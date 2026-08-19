"use client";

import { useRef, useState, type ReactNode } from "react";

import { CheckGlyph, CopyGlyph } from "./Icons";

/**
 * The dark terminal: the only dark surface in the system, and the product shot itself. On the
 * landing page it holds a scripted transcript; in the app it holds the live agent session.
 */
export function Term({
  title,
  children,
  className = "",
  bodyClassName = "",
  maxHeight,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  maxHeight?: number;
}) {
  return (
    <div className={`term ${className}`.trim()}>
      <div className="term-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        {title}
      </div>
      <div
        className={`term-body ${maxHeight ? "term-scroll" : ""} ${bodyClassName}`.trim()}
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function Ln({
  who,
  you = false,
  children,
}: {
  who?: string;
  you?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ln">
      <span className={`who${you ? " you" : ""}`}>{who ?? ""}</span>
      <span className="said">{children}</span>
    </div>
  );
}

export function Challenge({ children }: { children: ReactNode }) {
  return <div className="challenge">{children}</div>;
}

export function Sp() {
  return <div className="sp" />;
}

/** Code block with the copy affordance the docs use: label swaps to `copied` for 1600ms. */
export function CodeBlock({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the code is selectable either way */
    }
  };

  return (
    <div className="term" style={{ position: "relative" }}>
      <div className="term-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        {title}
      </div>
      <button className="cp" onClick={copy} type="button" aria-label="Copy to clipboard">
        {copied ? "copied" : "copy"}
      </button>
      <div className="term-body" style={{ overflowX: "auto" }}>
        <pre dangerouslySetInnerHTML={{ __html: code }} />
      </div>
    </div>
  );
}

/** Inline copy control for hashes and addresses; swaps its glyph, not its width. */
export function CopyInline({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  return (
    <button
      type="button"
      className="link-quiet"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
    >
      {label}
      {copied ? <CheckGlyph /> : <CopyGlyph />}
    </button>
  );
}
