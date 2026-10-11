import Link from "next/link";

import { ConnectWallet } from "./ConnectWallet";
import { BrandMark } from "./Icons";

/**
 * 58px row. Landing keeps it static; the app and docs make it sticky with a translucent blur and a
 * bottom hairline, matched by `scroll-padding-top` in globals.css.
 */
export function Nav({
  sticky = false,
  wallet = false,
  active,
}: {
  sticky?: boolean;
  wallet?: boolean;
  active?: "app" | "docs";
}) {
  return (
    <div className={sticky ? "nav-sticky" : undefined}>
      <div className="in">
        <nav className="nav">
          <Link href="/" className="brand">
            <span className="brand-tile">
              <BrandMark />
            </span>
            <span>
              <span className="brand-intent">intent</span>flow
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Link href="/app" className="nav-link" data-active={active === "app"}>
              App
            </Link>
            <Link href="/docs" className="nav-link" data-active={active === "docs"}>
              Docs
            </Link>
            <Link href="/#how" className="nav-link sm-hide">
              How it works
            </Link>
            {wallet ? <ConnectWallet compact /> : null}
          </div>
        </nav>
      </div>
    </div>
  );
}
