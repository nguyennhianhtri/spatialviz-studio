"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { useSceneStore } from "@/store/scene-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Valuation {
  flat_type: string;
  estimated_value_sgd: number;
  price_per_sqm: number;
  median_price: number;
  min_price: number;
  max_price: number;
  transaction_count: number;
  period: string;
  town: string;
  data_source: string;
}

export function ValuationPanel() {
  const { scene } = useSceneStore();
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scene) return;
    setLoading(true);
    fetch(`${API_URL}/api/valuation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total_area_sqm: scene.metadata.total_area_sqm,
        town: "ALL",
      }),
    })
      .then((r) => r.json())
      .then((data) => setValuation(data))
      .catch((err) => console.error("Valuation fetch failed:", err))
      .finally(() => setLoading(false));
  }, [scene]);

  if (!scene) return null;

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="absolute left-4 bottom-16 w-72 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-xl"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
        <DollarSign className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold">Market Valuation</span>
        <span className="ml-auto text-[10px] text-[var(--text-secondary)]">
          data.gov.sg
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading market data...
          </div>
        ) : valuation && valuation.estimated_value_sgd > 0 ? (
          <>
            {/* Estimated value */}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Estimated Market Value
              </p>
              <p className="text-2xl font-bold text-emerald-400">
                S${(valuation.estimated_value_sgd / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {valuation.flat_type} flat • {scene.metadata.total_area_sqm}m²
              </p>
            </div>

            {/* Price stats */}
            <div className="grid grid-cols-2 gap-2">
              <ValStat
                icon={<TrendingUp className="h-3 w-3" />}
                label="Price/m²"
                value={`S$${valuation.price_per_sqm.toLocaleString()}`}
              />
              <ValStat
                icon={<BarChart3 className="h-3 w-3" />}
                label="Median"
                value={`S$${(valuation.median_price / 1000).toFixed(0)}K`}
              />
            </div>

            {/* Range bar */}
            <div>
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
                <span>S${(valuation.min_price / 1000).toFixed(0)}K</span>
                <span>S${(valuation.max_price / 1000).toFixed(0)}K</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--bg-card)] mt-1">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((valuation.estimated_value_sgd - valuation.min_price) /
                        (valuation.max_price - valuation.min_price)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <p className="text-[10px] text-[var(--text-secondary)]">
              Based on {valuation.transaction_count.toLocaleString()} transactions •{" "}
              {valuation.period}
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            No valuation data available for this flat type.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ValStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-card)] p-2">
      <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}
