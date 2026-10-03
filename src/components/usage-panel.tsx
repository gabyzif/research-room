"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "@/components/language-provider";
import type { UsageView } from "@/lib/models/view-types";

type CreditsResponse = { connected: boolean; remaining?: number; totalCredits?: number; error?: boolean };

export function UsagePanel({ usage }: { usage: Record<string, UsageView> }) {
  const t = useTranslations();
  const values = Object.values(usage);
  const tokens = values.reduce((sum, value) => sum + value.inputTokens + value.outputTokens, 0);
  const cost = values.reduce((sum, value) => sum + (value.costUsd ?? 0), 0);

  const [credits, setCredits] = useState<CreditsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CreditsResponse | null) => { if (!cancelled) setCredits(data); })
      .catch(() => { if (!cancelled) setCredits(null); });
    return () => { cancelled = true; };
  }, [cost]);

  const showBalance = credits?.connected && !credits.error && typeof credits.remaining === "number";
  const noBalance = credits?.connected && !credits.error && credits.totalCredits === 0;
  const spentHint = t("usage.spentHint", { tokens: String(tokens), cost: `$${cost.toFixed(4)}` });

  return (
    <div className="usage-panel-v2">
      {showBalance && !noBalance && (
        <span className="usage-balance-pill" title={t("usage.balanceHint")}>
          <span className="usage-balance-label">{t("usage.availableLabel")}</span>
          <b>${credits!.remaining!.toFixed(2)}</b>
        </span>
      )}
      {noBalance && (
        <span className="usage-balance-pill usage-balance-free" title={t("usage.balanceFreeHint")}>
          {t("usage.balanceFree")}
        </span>
      )}
      <span className="usage-spent" title={spentHint}>
        {t("usage.spentInRoom", { cost: `$${cost.toFixed(4)}` })}
      </span>
    </div>
  );
}
