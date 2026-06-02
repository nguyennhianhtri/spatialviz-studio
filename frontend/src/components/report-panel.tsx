"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileBarChart2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSceneStore } from "@/store/scene-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Report {
  summary: string;
  accessibility_score: number;
  issues: string[];
  recommendations: string[];
}

export function ReportPanel() {
  const { scene } = useSceneStore();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const generateReport = async () => {
    if (!scene) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      if (!res.ok) throw new Error("Report generation failed");
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor =
    report && report.accessibility_score >= 80
      ? "text-green-400"
      : report && report.accessibility_score >= 50
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="absolute right-4 top-4 w-80">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-xl"
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold">Executive Insights</span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                {/* Quick stats */}
                {scene && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <QuickStat label="Rooms" value={`${scene.rooms.length}`} />
                    <QuickStat
                      label="Area"
                      value={`${scene.metadata.total_area_sqm}m²`}
                    />
                    <QuickStat
                      label="Doors"
                      value={`${scene.doors.length}`}
                    />
                  </div>
                )}

                {/* Generate report button */}
                {!report && (
                  <button
                    onClick={generateReport}
                    disabled={loading || !scene}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <FileBarChart2 className="h-4 w-4" />
                        Generate Accessibility Report
                      </>
                    )}
                  </button>
                )}

                {/* Report results */}
                {report && (
                  <div className="space-y-3">
                    {/* Score */}
                    <div className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] p-3">
                      <span className="text-xs text-[var(--text-secondary)]">
                        Accessibility Score
                      </span>
                      <span className={`text-2xl font-bold ${scoreColor}`}>
                        {report.accessibility_score}/100
                      </span>
                    </div>

                    {/* Summary */}
                    <div className="text-xs text-[var(--text-secondary)]">
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {report.summary}
                      </Markdown>
                    </div>

                    {/* Issues */}
                    {report.issues.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-red-400 mb-1">
                          <AlertTriangle className="h-3 w-3" />
                          Issues ({report.issues.length})
                        </div>
                        <ul className="space-y-1">
                          {report.issues.map((issue, i) => (
                            <li
                              key={i}
                              className="text-xs text-[var(--text-secondary)] pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-red-400"
                            >
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {report.recommendations.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-green-400 mb-1">
                          <Lightbulb className="h-3 w-3" />
                          Recommendations
                        </div>
                        <ul className="space-y-1">
                          {report.recommendations.map((rec, i) => (
                            <li
                              key={i}
                              className="text-xs text-[var(--text-secondary)] pl-4 relative before:content-['✓'] before:absolute before:left-1 before:text-green-400"
                            >
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => setReport(null)}
                      className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] underline"
                    >
                      Regenerate report
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-card)] p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
