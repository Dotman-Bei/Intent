import Link from "next/link";

import { EXPLORER_URL, botChain } from "@/config/chains";

import { BrandMark } from "./Icons";

const GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Executor", href: "/app" },
      { label: "How it works", href: "/#how" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Contracts", href: "/docs#contracts" },
      { label: "Agent API", href: "/docs#api" },
    ],
  },
  {
    title: "Chain",
    links: [
      { label: "Explorer", href: EXPLORER_URL },
      { label: "BOT Chain", href: "https://www.botchain.ai/en" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="in" style={{ borderTop: "1px solid var(--line)", paddingBlock: "40px 52px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        <div className="measure-34" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/" className="brand">
            <span className="brand-tile">
              <BrandMark />
            </span>
            <span>
              <span className="brand-intent">intent</span>flow
            </span>
          </Link>
          <p className="small">
            Natural language in, an audited-path transaction out. Every strategy is whitelisted
            on-chain and every position is read back from {botChain.name}.
          </p>
          <p className="small" style={{ color: "var(--faint)" }}>
            MIT licensed. Built for the BOT Chain AI Native Applications track.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 40 }}>
          {GROUPS.map((group) => (
            <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span className="kicker">{group.title}</span>
              {group.links.map((link) =>
                link.href.startsWith("http") ? (
                  <a
                    key={link.label}
                    className="link-quiet"
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.label} className="link-quiet" href={link.href}>
                    {link.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
