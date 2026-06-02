import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpatialViz Studio — 2D Floor Plans to Interactive 3D",
  description:
    "Upload a 2D floor plan and get an interactive 3D visualization in seconds. AI-powered spatial intelligence for city planners, facilities managers, and housing authorities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a1a2e",
              color: "#f1f5f9",
              border: "1px solid #2a2a3e",
            },
          }}
        />
      </body>
    </html>
  );
}
