"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { WalletGlyph } from "./Icons";

/**
 * RainbowKit's default button carries its own colour language; the page allows exactly one black
 * button and one gold accent, so the trigger is rebuilt here and only the modal is left as-is.
 */
export function ConnectWallet({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return <div className="skeleton" style={{ width: 132, height: compact ? 30 : 36 }} />;
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`btn${compact ? " btn-sm" : ""}`}
            >
              <WalletGlyph size={12} />
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={`btn${compact ? " btn-sm" : ""}`}
              style={{ background: "var(--gold)" }}
            >
              Wrong network — switch
            </button>
          );
        }

        return (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={openChainModal} className="pill sm-hide">
              <span className="dot" />
              {chain.name}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className={`btn${compact ? " btn-sm" : ""}`}
              style={{ fontFamily: "var(--mono)", fontSize: 12 }}
            >
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
