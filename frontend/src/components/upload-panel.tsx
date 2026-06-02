"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileImage, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSceneStore } from "@/store/scene-store";
import toast from "react-hot-toast";
import type { SceneGraph } from "@/types/scene";
import type { ExtractionResult } from "@/store/scene-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STEPS = [
  "Uploading floor plan...",
  "Running Content Understanding OCR...",
  "Classifying dimensions spatially...",
  "Inferring room layout with GPT-5...",
  "Building 2D layout...",
  "Done!",
];

export function UploadPanel() {
  const { setScene, setExtraction, setProcessing, isProcessing, processingStep } = useSceneStore();
  const [currentStep, setCurrentStep] = useState(0);

  const handleUpload = useCallback(
    async (file: File) => {
      setProcessing(true, STEPS[0]);
      setCurrentStep(0);

      const formData = new FormData();
      formData.append("file", file);

      try {
        // Step progression while waiting for CU + GPT-5 inference
        const stepTimer = setInterval(() => {
          setCurrentStep((prev) => {
            const next = Math.min(prev + 1, STEPS.length - 2);
            setProcessing(true, STEPS[next]);
            return next;
          });
        }, 2500);

        const res = await fetch(`${API_URL}/api/extract`, {
          method: "POST",
          body: formData,
        });

        clearInterval(stepTimer);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Server error" }));
          throw new Error(err.detail || "Extraction failed");
        }

        const data: ExtractionResult = await res.json();

        setCurrentStep(STEPS.length - 1);
        setProcessing(true, STEPS[STEPS.length - 1]);

        setTimeout(() => {
          setExtraction(data);
          const rooms = data.inferred_layout?.rooms || [];
          const bedrooms = rooms.filter((r) => r.type === "bedroom").length;
          const hdbRoomCount = bedrooms + 1; // HDB convention: bedrooms + 1
          const cuTime = data.cu_time_ms ? `CU: ${(data.cu_time_ms / 1000).toFixed(1)}s` : "";
          const gptTime = data.inference_time_ms ? ` | GPT-5: ${(data.inference_time_ms / 1000).toFixed(1)}s` : "";
          toast.success(
            `Extracted ${hdbRoomCount}-room flat (${bedrooms} bedrooms) in ${(data.processing_time_ms / 1000).toFixed(1)}s (${cuTime}${gptTime})`
          );
        }, 500);
      } catch (err) {
        setProcessing(false);
        setCurrentStep(0);
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [setExtraction, setProcessing]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    disabled: isProcessing,
  });

  const loadDemo = async () => {
    setProcessing(true, "Loading demo scene...");
    try {
      const res = await fetch(`${API_URL}/api/demo-scene`);
      if (!res.ok) throw new Error("Failed to load demo");
      const scene: SceneGraph = await res.json();
      setScene(scene);
      toast.success("Demo scene loaded!");
    } catch {
      setProcessing(false);
      toast.error("Could not load demo scene");
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 px-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Transform 2D Floor Plans into
          <br />
          <span className="text-[var(--accent)]">Interactive 3D Spaces</span>
        </h2>
        <p className="mt-3 max-w-lg text-[var(--text-secondary)]">
          Upload a floor plan and watch AI convert it into a walkable 3D
          visualization in seconds. Powered by GPT-5 vision and Three.js.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
              <span className="text-sm font-medium">{processingStep}</span>
            </div>
            <div className="flex flex-col gap-2">
              {STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2 text-sm">
                  {i < currentStep ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                  ) : i === currentStep ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-[var(--border)]" />
                  )}
                  <span
                    className={
                      i <= currentStep
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            {...getRootProps()}
            className={`flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors ${isDragActive
                ? "border-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50"
              }`}
          >
            <input {...getInputProps()} />
            <div className="rounded-xl bg-[var(--accent)]/10 p-4">
              {isDragActive ? (
                <FileImage className="h-8 w-8 text-[var(--accent)]" />
              ) : (
                <Upload className="h-8 w-8 text-[var(--accent)]" />
              )}
            </div>
            <div className="text-center">
              <p className="font-medium">
                {isDragActive ? "Drop your floor plan" : "Upload a floor plan"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                PNG, JPG, or PDF — up to 20MB
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isProcessing && (
        <button
          onClick={loadDemo}
          className="text-sm text-[var(--text-secondary)] underline decoration-dotted underline-offset-4 hover:text-[var(--accent)] transition-colors"
        >
          or try a demo floor plan →
        </button>
      )}
    </div>
  );
}
