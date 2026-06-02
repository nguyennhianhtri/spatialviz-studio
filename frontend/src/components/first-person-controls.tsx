"use client";

/**
 * First-person walk controller for the 3D viewer.
 * 
 * WASD to move, mouse drag to look around.
 * Eye height at 1.6m. Wall collision prevents walking through walls.
 * Doorways allow passage when the door is open (player nearby).
 */

import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const MOVE_SPEED = 3.5; // meters per second
const LOOK_SPEED = 0.002;
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.25; // collision radius in meters
const DOOR_OPEN_DISTANCE = 2.0; // must match scene-derived.tsx

// ─── Wall collision data (set by Viewer3D) ───
export interface WallSegment {
  ax: number; az: number; // start point (XZ plane)
  bx: number; bz: number; // end point
  thickness: number;
}

export interface DoorOpening {
  x: number; z: number; // center of door on wall
  halfWidth: number; // half the door width
  edgeAngle: number; // angle of the wall the door sits on
}

/** Shared ref — Viewer3D writes wall/door data here once on scene load */
export const collisionDataRef: {
  current: { walls: WallSegment[]; doors: DoorOpening[] };
} = { current: { walls: [], doors: [] } };

// ─── Collision math ───

/** Shortest distance from point (px,pz) to line segment (ax,az)-(bx,bz) */
function pointToSegmentDist(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number,
): { dist: number; nx: number; nz: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) {
    const d = Math.hypot(px - ax, pz - az);
    return { dist: d, nx: (px - ax) / (d || 1), nz: (pz - az) / (d || 1), t: 0 };
  }
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestZ = az + t * dz;
  const d = Math.hypot(px - closestX, pz - closestZ);
  return {
    dist: d,
    nx: d > 1e-8 ? (px - closestX) / d : 0,
    nz: d > 1e-8 ? (pz - closestZ) / d : 0,
    t,
  };
}

/** Check if position (px,pz) is within an open doorway on a wall segment */
function isInDoorway(
  px: number, pz: number,
  wall: WallSegment,
  doors: DoorOpening[],
): boolean {
  for (const door of doors) {
    // Project door center and player onto the wall axis
    const wdx = wall.bx - wall.ax;
    const wdz = wall.bz - wall.az;
    const wLen = Math.hypot(wdx, wdz);
    if (wLen < 1e-6) continue;
    const ux = wdx / wLen;
    const uz = wdz / wLen;

    // Door center projected onto wall
    const doorT = ((door.x - wall.ax) * ux + (door.z - wall.az) * uz);
    // Player projected onto wall
    const playerT = ((px - wall.ax) * ux + (pz - wall.az) * uz);

    // Check if player is within door opening range along the wall
    if (Math.abs(playerT - doorT) < door.halfWidth + PLAYER_RADIUS * 0.5) {
      // Also check the door is nearby (not on a parallel distant wall)
      const perpDist = Math.abs((px - wall.ax) * (-uz) + (pz - wall.az) * ux);
      if (perpDist < door.halfWidth + 1.0) {
        // Check door is open (player within open distance of door)
        const distToDoor = Math.hypot(px - door.x, pz - door.z);
        if (distToDoor < DOOR_OPEN_DISTANCE + 0.5) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Resolve collisions: given desired new position, return corrected position */
function resolveCollisions(
  newX: number, newZ: number,
  oldX: number, oldZ: number,
): { x: number; z: number } {
  const { walls, doors } = collisionDataRef.current;
  if (walls.length === 0) return { x: newX, z: newZ };

  let x = newX;
  let z = newZ;
  const collisionRadius = PLAYER_RADIUS;

  // Iterate a few times to handle corner cases
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;
    for (const wall of walls) {
      const { dist, nx, nz } = pointToSegmentDist(x, z, wall.ax, wall.az, wall.bx, wall.bz);
      const minDist = collisionRadius + wall.thickness / 2;

      if (dist < minDist) {
        // Check if we're in a doorway — if so, allow passage
        if (isInDoorway(x, z, wall, doors)) continue;

        // Push player out of wall
        const pushDist = minDist - dist;
        x += nx * pushDist;
        z += nz * pushDist;
        pushed = true;
      }
    }
    if (!pushed) break;
  }

  return { x, z };
}

// ─── Component ───

/** Shared refs so external entry animations can set the initial look direction. */
export const walkLookRef = { current: { yaw: 0, pitch: 0, set: false } };

export function FirstPersonControls() {
  const { camera, gl } = useThree();
  const keysRef = useRef<Set<string>>(new Set());

  // Sync to shared ref so door interaction can read keys
  useEffect(() => {
    playerKeysRef.current = keysRef.current;
  }, []);
  const isLockedRef = useRef(false);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  // Initialize camera for walk mode
  useEffect(() => {
    camera.position.y = EYE_HEIGHT;
    if (walkLookRef.current.set) {
      yawRef.current = walkLookRef.current.yaw;
      pitchRef.current = walkLookRef.current.pitch;
      walkLookRef.current.set = false;
    } else {
      // Set initial yaw from current camera direction
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      yawRef.current = Math.atan2(-dir.x, -dir.z);
      pitchRef.current = Math.asin(dir.y);
    }
  }, [camera]);

  // Keyboard handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysRef.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Pointer lock for mouse look
  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      // Only lock on canvas clicks (right or left button)
      if (e.target === gl.domElement) {
        gl.domElement.requestPointerLock();
      }
    },
    [gl]
  );

  const onPointerLockChange = useCallback(() => {
    isLockedRef.current = document.pointerLockElement === gl.domElement;
  }, [gl]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isLockedRef.current) return;
    yawRef.current -= e.movementX * LOOK_SPEED;
    pitchRef.current -= e.movementY * LOOK_SPEED;
    // Clamp pitch to prevent flipping
    pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitchRef.current));
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      // Exit pointer lock on cleanup
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl, onPointerDown, onPointerLockChange, onMouseMove]);

  // Per-frame movement and look
  useFrame((_, delta) => {
    const keys = keysRef.current;
    const clampedDelta = Math.min(delta, 0.1); // Prevent huge jumps

    // Apply look rotation
    euler.current.set(pitchRef.current, yawRef.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler.current);

    // Calculate movement direction
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    const move = new THREE.Vector3();

    if (keys.has("w") || keys.has("arrowup")) move.add(forward);
    if (keys.has("s") || keys.has("arrowdown")) move.sub(forward);
    if (keys.has("d") || keys.has("arrowright")) move.add(right);
    if (keys.has("a") || keys.has("arrowleft")) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MOVE_SPEED * clampedDelta);
      const oldX = camera.position.x;
      const oldZ = camera.position.z;
      const newX = oldX + move.x;
      const newZ = oldZ + move.z;

      // Resolve wall collisions
      const resolved = resolveCollisions(newX, newZ, oldX, oldZ);
      camera.position.x = resolved.x;
      camera.position.z = resolved.z;
    }

    // Lock Y to eye height
    camera.position.y = EYE_HEIGHT;
  });

  return null;
}

/**
 * Player position provider — exposes camera position for proximity checks.
 * Uses a shared ref that door components can read.
 */
export const playerPositionRef = { current: new THREE.Vector3() };
/** Player heading (yaw) in radians — 0 = looking down +Z (south in plan view). */
export const playerYawRef = { current: 0 };
/** Player look direction as a unit vector on XZ plane. */
export const playerDirRef = { current: new THREE.Vector3(0, 0, -1) };
/** Set of currently-held keys (lowercase). Read by door interaction etc. */
export const playerKeysRef: { current: Set<string> } = { current: new Set() };

export function PlayerPositionTracker() {
  const { camera } = useThree();

  useFrame(() => {
    playerPositionRef.current.copy(camera.position);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    playerYawRef.current = Math.atan2(dir.x, dir.z);
    playerDirRef.current.set(dir.x, 0, dir.z).normalize();
  });

  return null;
}
