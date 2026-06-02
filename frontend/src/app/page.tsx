"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UploadPanel } from "@/components/upload-panel";
import { FloorPlanEditor } from "@/components/floor-plan-editor";
import { Viewer3D } from "@/components/viewer-3d";
import { ChatPanel } from "@/components/chat-panel";
import { Header } from "@/components/header";
import { useSceneStore } from "@/store/scene-store";

export default function Home() {
  const { stage } = useSceneStore();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header onToggleChat={() => setChatOpen(!chatOpen)} chatOpen={chatOpen} />

      <main className="flex flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {stage === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-1 items-center justify-center"
            >
              <UploadPanel />
            </motion.div>
          )}

          {stage === "editor" && (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 overflow-hidden"
            >
              <FloorPlanEditor />
            </motion.div>
          )}

          {stage === "viewer" && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 overflow-hidden"
            >
              <div className="flex-1 min-w-0 relative">
                <Viewer3D />
              </div>
              {chatOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 400, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="border-l border-[var(--border)] flex-shrink-0 h-full"
                >
                  <div className="w-[400px] h-full">
                    <ChatPanel />
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
