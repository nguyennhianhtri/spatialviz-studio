"use client";

import { motion } from "framer-motion";
import type { RoomDef } from "@/types/scene";
import { X } from "lucide-react";
import { useSceneStore } from "@/store/scene-store";

export function RoomInfo({ room }: { room: RoomDef }) {
  const { selectRoom } = useSceneStore();

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="absolute left-4 top-4 w-72 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/90 p-4 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{room.label}</h3>
          <p className="text-xs text-[var(--text-secondary)] capitalize">
            {room.type} room
          </p>
        </div>
        <button
          onClick={() => selectRoom(null)}
          className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Area" value={`${room.area_sqm} m²`} />
        <Stat label="Type" value={room.type} />
        <Stat
          label="Vertices"
          value={`${room.polygon.length}`}
        />
        <Stat label="Floor" value={room.floor_material.replace("_", " ")} />
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-card)] p-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
