import type { ReactNode } from "react";

import { ArrowRight } from "./Icons";

export function Pill({
  children,
  href,
  tone = "gold",
}: {
  children: ReactNode;
  href?: string;
  tone?: "gold" | "ink" | "faint";
}) {
  const dot = <span className={`dot${tone === "ink" ? " dot-ink" : tone === "faint" ? " dot-faint" : ""}`} />;
  if (href) {
    return (
      <a className="pill" href={href} target="_blank" rel="noreferrer">
        {dot}
        {children}
      </a>
    );
  }
  return (
    <span className="pill">
      {dot}
      {children}
    </span>
  );
}

export function SectionHead({
  kicker,
  title,
  sub,
  centred = false,
  mono = false,
}: {
  kicker: string;
  title: ReactNode;
  sub?: ReactNode;
  centred?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className="rv"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: centred ? "center" : "flex-start",
        textAlign: centred ? "center" : "left",
        marginInline: centred ? "auto" : undefined,
      }}
    >
      <span className={`kicker${mono ? " kicker-mono" : ""}`}>{kicker}</span>
      <h2 className={centred ? "measure-58" : "measure-58"}>{title}</h2>
      {sub ? <p className={`sub ${centred ? "measure-50" : "measure-58"}`}>{sub}</p> : null}
    </div>
  );
}

export function Cell({
  kicker,
  value,
  title,
  children,
  tight = false,
}: {
  kicker?: string;
  value?: string;
  title?: string;
  children?: ReactNode;
  tight?: boolean;
}) {
  return (
    <div className={`cell${tight ? " cell-tight" : ""} rv`}>
      {kicker ? <span className="kicker">{kicker}</span> : null}
      {value ? <span className="n">{value}</span> : null}
      {title ? <h3>{title}</h3> : null}
      {children ? <p className="small">{children}</p> : null}
    </div>
  );
}

export function Steps({
  items,
}: {
  items: { title: string; body: ReactNode }[];
}) {
  return (
    <div className="steps">
      {items.map((item, index) => (
        <div className="step rv" key={item.title}>
          <span className="step-i">{String(index + 1).padStart(2, "0")}</span>
          <h3>{item.title}</h3>
          <p className="small">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function StatementRows({ rows }: { rows: { lead: string; body: string }[] }) {
  return (
    <div className="rv">
      {rows.map((row) => (
        <div className="row-i" key={row.lead}>
          <p className="small">
            <b style={{ color: "var(--ink)" }}>{row.lead}</b> {row.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="note rv">{children}</div>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a className="link" href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
      <ArrowRight />
    </a>
  );
}

export function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: (ReactNode[] | { cells: ReactNode[] })[];
}) {
  return (
    <div className="tw rv">
      <table>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const cells = Array.isArray(row) ? row : row.cells;
            return (
              <tr key={index}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cellIndex === 0 ? undefined : "txt"}>
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
