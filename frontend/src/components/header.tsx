"use client";

import { Box, MessageSquare, Sun, Moon, Eye, Move3D, ArrowDown } from "lucide-react";

interface HeaderProps {
  onToggleChat: () => void;
  chatOpen: boolean;
}

export function Header({ onToggleChat, chatOpen }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-secondary)] px-6">
      <div className="flex items-center gap-3">
        <Box className="h-6 w-6 text-[var(--accent)]" />
        <h1 className="text-lg font-semibold tracking-tight">
          SpatialViz<span className="text-[var(--accent)]"> Studio</span>
        </h1>
        <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)]">
          Prototype
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            chatOpen
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Planner Copilot
        </button>
      </div>
    </header>
  );
}
