"use client";

import { useSceneStore } from "@/store/scene-store";
import { Eye, Move3D, Sun, Moon, RotateCcw, Download, Footprints } from "lucide-react";

export function SceneToolbar() {
  const { viewMode, setViewMode, dayMode, setDayMode, scene, reset } =
    useSceneStore();

  const exportGlb = () => {
    // Placeholder — in full build, use THREE.GLTFExporter
    alert("GLB export coming soon");
  };

  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/90 p-1 backdrop-blur-sm">
      <ToolbarButton
        active={viewMode === "orbit"}
        onClick={() => setViewMode("orbit")}
        icon={<RotateCcw className="h-4 w-4" />}
        label="Orbit"
      />
      <ToolbarButton
        active={viewMode === "topdown"}
        onClick={() => setViewMode("topdown")}
        icon={<Eye className="h-4 w-4" />}
        label="Top"
      />
      <ToolbarButton
        active={viewMode === "walkthrough"}
        onClick={() => setViewMode("walkthrough")}
        icon={<Footprints className="h-4 w-4" />}
        label="Walk"
      />

      <div className="mx-1 h-6 w-px bg-[var(--border)]" />

      <ToolbarButton
        active={dayMode === "day"}
        onClick={() => setDayMode(dayMode === "day" ? "night" : "day")}
        icon={
          dayMode === "day" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )
        }
        label={dayMode === "day" ? "Day" : "Night"}
      />

      <div className="mx-1 h-6 w-px bg-[var(--border)]" />

      <ToolbarButton
        onClick={exportGlb}
        icon={<Download className="h-4 w-4" />}
        label="Export"
      />

      <ToolbarButton
        onClick={reset}
        icon={<RotateCcw className="h-4 w-4" />}
        label="New"
      />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
