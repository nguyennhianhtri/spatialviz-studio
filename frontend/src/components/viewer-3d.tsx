"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, ContactShadows, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useSceneStore } from "@/store/scene-store";
import { SceneToolbar } from "@/components/scene-toolbar";
import { RoomInfo } from "@/components/room-info";
import { ReportPanel } from "@/components/report-panel";
import { ValuationPanel } from "@/components/valuation-panel";
import { RoomFloor, DerivedWall, DerivedDoor, DerivedWindow, RoomFurniture } from "@/components/scene-derived";
import { deriveSceneGeometry } from "@/lib/geometry-engine";
import { FirstPersonControls, PlayerPositionTracker, collisionDataRef, walkLookRef } from "@/components/first-person-controls";
import { Minimap } from "@/components/minimap";
import type { SceneGraph } from "@/types/scene";

function Scene({ scene }: { scene: SceneGraph }) {
  const { selectedRoom, selectRoom, dayMode } = useSceneStore();

  // Derive wall geometry from room polygons
  const derived = useMemo(() => deriveSceneGeometry(scene), [scene]);

  // Populate collision data for first-person walk mode
  useEffect(() => {
    // Build wall segments from derived edges
    const walls = derived.edges.map((edge) => ({
      ax: edge.start.x,
      az: edge.start.y, // y in 2D = z in 3D
      bx: edge.end.x,
      bz: edge.end.y,
      thickness: edge.thickness,
    }));

    // Build door openings from placed doors
    const doors = derived.doors.map((placement) => {
      const { door, edge, t } = placement;
      const px = edge.start.x + t * (edge.end.x - edge.start.x);
      const pz = edge.start.y + t * (edge.end.y - edge.start.y);
      return {
        x: px,
        z: pz,
        halfWidth: door.width_m / 2,
        edgeAngle: edge.angle,
      };
    });

    collisionDataRef.current = { walls, doors };
  }, [derived]);

  return (
    <>
      {/* Lighting */}
      {dayMode === "day" ? (
        <>
          <ambientLight intensity={0.4} color="#FFF5E8" />
          <directionalLight
            position={[15, 25, 12]}
            intensity={1.8}
            castShadow
            shadow-mapSize={[4096, 4096]}
            shadow-camera-far={60}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-bias={-0.0001}
          />
          <directionalLight position={[-8, 12, -6]} intensity={0.4} color="#B8D0E8" />
          <directionalLight position={[0, 8, 15]} intensity={0.2} color="#FFE8D0" />
          {/* Hemisphere light for natural sky/ground bounce */}
          <hemisphereLight args={["#87CEEB", "#8B7355", 0.3]} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.15} color="#1a1a3e" />
          {/* Warm ceiling lights spread across the flat */}
          <pointLight position={[3, 2.5, 4]} intensity={2.5} color="#FFD080" distance={12} decay={1.5} />
          <pointLight position={[8, 2.5, 4]} intensity={2.5} color="#FFD080" distance={12} decay={1.5} />
          <pointLight position={[3, 2.5, 9]} intensity={2.0} color="#FFD080" distance={12} decay={1.5} />
          <pointLight position={[8, 2.5, 9]} intensity={2.0} color="#FFD080" distance={12} decay={1.5} />
          <pointLight position={[5.5, 2.5, 6.5]} intensity={2.0} color="#FFE0A0" distance={10} decay={1.5} />
          {/* Kitchen / wet zone area */}
          <pointLight position={[10, 2.5, 3]} intensity={1.8} color="#FFE0A0" distance={10} decay={1.5} />
          <pointLight position={[10, 2.5, 8]} intensity={1.5} color="#FFD080" distance={10} decay={1.5} />
          <hemisphereLight args={["#1a1a3e", "#0a0a1e", 0.25]} />
        </>
      )}

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0E0E16" roughness={0.95} />
      </mesh>

      {/* Subtle grid */}
      <Grid
        args={[40, 40]}
        position={[0, -0.005, 0]}
        cellSize={1}
        cellColor="#1E1E2A"
        sectionSize={5}
        sectionColor="#282838"
        fadeDistance={35}
        infiniteGrid
      />

      {/* Stars background */}
      <Stars radius={60} depth={50} count={1500} factor={3} saturation={0} fade speed={0.5} />

      {/* Contact shadows */}
      <ContactShadows position={[6, 0, 4]} opacity={0.5} scale={25} blur={2.5} far={12} />

      {/* Room floors + labels (from polygon data) */}
      {scene.rooms.map((room) => (
        <RoomFloor
          key={room.id}
          room={room}
          isSelected={selectedRoom === room.id}
          onSelect={() => selectRoom(selectedRoom === room.id ? null : room.id)}
        />
      ))}

      {/* Walls — DERIVED from room polygon edges (geometry engine) */}
      {derived.edges.map((edge, i) => (
        <DerivedWall
          key={`wall-${i}`}
          edge={edge}
          allDoorPlacements={derived.doors}
          allWindowPlacements={derived.windows}
        />
      ))}

      {/* Doors — placed on nearest derived wall edge */}
      {derived.doors.map((placement, i) => (
        <DerivedDoor key={`door-${i}`} placement={placement} />
      ))}

      {/* Windows — placed on nearest derived wall edge */}
      {derived.windows.map((placement, i) => (
        <DerivedWindow key={`win-${i}`} placement={placement} />
      ))}

      {/* Auto-placed furniture */}
      {scene.rooms.map((room) => (
        <RoomFurniture key={`furn-${room.id}`} room={room} scene={scene} />
      ))}
    </>
  );
}

// Camera controller that reacts to viewMode (orbit / topdown only)
function OrbitCameraController({ cx, cz }: { cx: number; cz: number }) {
  const { viewMode } = useSceneStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!camera || viewMode === "walkthrough") return;
    const dur = 600;
    const start = performance.now();
    const startPos = camera.position.clone();

    let targetPos: THREE.Vector3;
    let targetLookAt = new THREE.Vector3(cx, 0, cz);

    switch (viewMode) {
      case "topdown":
        targetPos = new THREE.Vector3(cx, 25, cz + 0.01);
        break;
      default: // orbit
        targetPos = new THREE.Vector3(cx + 12, 12, cz + 12);
        break;
    }

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(startPos, targetPos, ease);
      camera.lookAt(targetLookAt);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLookAt);
        controlsRef.current.update();
      }
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [viewMode, cx, cz, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={[cx, 0, cz]}
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={45}
      maxPolarAngle={viewMode === "topdown" ? 0.1 : Math.PI / 2.1}
      minPolarAngle={0}
      enableRotate={viewMode !== "topdown"}
    />
  );
}

// Walk mode entry — drops the player just OUTSIDE the main entrance,
// looking at the door, so they can see the house and walk in.
function WalkModeEntry({
  scene,
  cx,
  cz,
}: {
  scene: SceneGraph;
  cx: number;
  cz: number;
}) {
  const { camera } = useThree();
  const entered = useRef(false);

  useEffect(() => {
    if (entered.current) return;
    entered.current = true;

    const { entryX, entryZ, lookAtX, lookAtZ } = computeWalkEntry(scene, cx, cz);

    // Tell FirstPersonControls which direction we're facing so it doesn't
    // overwrite our look orientation on first frame.
    const yaw = Math.atan2(-(lookAtX - entryX), -(lookAtZ - entryZ));
    walkLookRef.current = { yaw, pitch: 0, set: true };

    const dur = 1000;
    const start = performance.now();
    const startPos = camera.position.clone();
    const targetPos = new THREE.Vector3(entryX, 1.6, entryZ);

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(startPos, targetPos, ease);
      camera.lookAt(new THREE.Vector3(lookAtX, 1.6, lookAtZ));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [scene, cx, cz, camera]);

  return null;
}

function computeWalkEntry(
  scene: SceneGraph,
  cx: number,
  cz: number,
): { entryX: number; entryZ: number; lookAtX: number; lookAtZ: number } {
  const mainDoor =
    scene.doors.find((d) => d.type === "main_entrance") || scene.doors[0];

  if (!mainDoor) {
    return { entryX: cx + 8, entryZ: cz + 8, lookAtX: cx, lookAtZ: cz };
  }

  const dx = mainDoor.position[0];
  const dz = mainDoor.position[1];
  let outX = dx - cx;
  let outZ = dz - cz;
  const len = Math.hypot(outX, outZ);
  if (len < 0.1) {
    outX = 1;
    outZ = 0;
  } else {
    outX /= len;
    outZ /= len;
  }
  const STAND_OFF = 2.5;
  return {
    entryX: dx + outX * STAND_OFF,
    entryZ: dz + outZ * STAND_OFF,
    lookAtX: dx,
    lookAtZ: dz,
  };
}

// Walk mode hint overlay
function WalkHint() {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/90 px-4 py-2 backdrop-blur-sm">
      <div className="flex gap-1">
        <kbd className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)]">W</kbd>
        <kbd className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)]">A</kbd>
        <kbd className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)]">S</kbd>
        <kbd className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)]">D</kbd>
      </div>
      <span className="text-xs text-[var(--text-secondary)]">Move</span>
      <div className="h-4 w-px bg-[var(--border)]" />
      <span className="text-xs text-[var(--text-secondary)]">Click to look around</span>
      <div className="h-4 w-px bg-[var(--border)]" />
      <kbd className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)]">E</kbd>
      <span className="text-xs text-[var(--text-secondary)]">Open/close doors</span>
    </div>
  );
}

export function Viewer3D() {
  const { scene, viewMode, selectedRoom } = useSceneStore();

  if (!scene) return null;

  const selectedRoomData = scene.rooms.find((r) => r.id === selectedRoom);

  // Compute scene center for camera target
  const allPts = scene.rooms.flatMap((r) => r.polygon);
  const cx = allPts.length > 0 ? allPts.reduce((s, p) => s + p[0], 0) / allPts.length : 5;
  const cz = allPts.length > 0 ? allPts.reduce((s, p) => s + p[1], 0) / allPts.length : 4;

  const isWalkMode = viewMode === "walkthrough";

  // Pre-set the walk look direction BEFORE FirstPersonControls mounts so it
  // initializes facing the entrance instead of facing the orbit-camera direction.
  if (isWalkMode) {
    const { entryX, entryZ, lookAtX, lookAtZ } = computeWalkEntry(scene, cx, cz);
    const yaw = Math.atan2(-(lookAtX - entryX), -(lookAtZ - entryZ));
    walkLookRef.current = { yaw, pitch: 0, set: true };
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: 4, // ACESFilmic for cinematic look
          toneMappingExposure: 1.1,
        }}
      >
        <PerspectiveCamera
          makeDefault
          position={[cx + 12, 10, cz + 12]}
          fov={isWalkMode ? 70 : 42}
          near={0.1}
          far={200}
        />
        <color attach="background" args={["#0A0A12"]} />
        <fog attach="fog" args={["#0A0A12", 40, 70]} />

        <Scene scene={scene} />

        {/* Player position tracker — always active for door proximity */}
        <PlayerPositionTracker />

        {/* Walk mode: WASD + mouse look */}
        {isWalkMode ? (
          <>
            <FirstPersonControls />
            <WalkModeEntry scene={scene} cx={cx} cz={cz} />
          </>
        ) : (
          <OrbitCameraController cx={cx} cz={cz} />
        )}
      </Canvas>

      {/* Walk mode hint overlay */}
      {isWalkMode && <WalkHint />}
      {/* Minimap — only useful in walk mode where you can lose orientation */}
      {isWalkMode && <Minimap scene={scene} />}

      <SceneToolbar />
      <ReportPanel />
      <ValuationPanel />

      {selectedRoomData && <RoomInfo room={selectedRoomData} />}
    </div>
  );
}
