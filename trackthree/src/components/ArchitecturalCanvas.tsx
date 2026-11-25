import { useEffect, useRef } from 'react';
import type { ThemeMode } from '../types/scholarship';

interface ArchitecturalCanvasProps {
  theme: ThemeMode;
}

type Vec3 = [number, number, number];

// Golden ratio for Platonic dodecahedron
const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

const DODECA_VERTICES: Vec3[] = [
  [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
  [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
  [0, -INV_PHI, -PHI], [0, -INV_PHI, PHI], [0, INV_PHI, -PHI], [0, INV_PHI, PHI],
  [-INV_PHI, -PHI, 0], [-INV_PHI, PHI, 0], [INV_PHI, -PHI, 0], [INV_PHI, PHI, 0],
  [-PHI, 0, -INV_PHI], [PHI, 0, -INV_PHI], [-PHI, 0, INV_PHI], [PHI, 0, INV_PHI],
];

// Connect vertices at exact dodecahedron edge distance (2 / PHI ≈ 1.236)
const DODECA_EDGES: Array<[number, number]> = [];
for (let i = 0; i < DODECA_VERTICES.length; i++) {
  for (let j = i + 1; j < DODECA_VERTICES.length; j++) {
    const dx = DODECA_VERTICES[i][0] - DODECA_VERTICES[j][0];
    const dy = DODECA_VERTICES[i][1] - DODECA_VERTICES[j][1];
    const dz = DODECA_VERTICES[i][2] - DODECA_VERTICES[j][2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (Math.abs(distSq - (4 / (PHI * PHI))) < 0.05) {
      DODECA_EDGES.push([i, j]);
    }
  }
}

const OCTA_VERTICES: Vec3[] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

const OCTA_EDGES: Array<[number, number]> = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 4], [4, 3], [3, 5], [5, 2],
];

function rotatePoint([x, y, z]: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;

  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;

  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return [x3, y3, z2];
}

export function ArchitecturalCanvas({ theme }: ArchitecturalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<ThemeMode>(theme);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let lastFrameTime = 0;
    const smoothPointer = { x: 0, y: 0 };
    const pointerClient = { x: -9999, y: -9999 };
    let smoothScroll = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMouseMove = (e: MouseEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerClient.x = e.clientX;
      pointerClient.y = e.clientY;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);

    const draw = (now: number) => {
      if (document.hidden) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      if (!prefersReducedMotion && lastFrameTime && now - lastFrameTime < 45) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      if (!prefersReducedMotion) {
        smoothPointer.x += (pointerRef.current.x - smoothPointer.x) * 0.08;
        smoothPointer.y += (pointerRef.current.y - smoothPointer.y) * 0.08;
        const targetScroll = Math.min(window.scrollY / Math.max(h, 1), 3);
        smoothScroll += (targetScroll - smoothScroll) * 0.1;
      }

      const t = prefersReducedMotion ? 0.6 : now * 0.00028;
      const isDark = themeRef.current === 'dark';

      // Subtle architectural cursor illumination on desktop (bounded fill region)
      if (pointerClient.x > 0 && w >= 1024 && !prefersReducedMotion) {
        const radius = 320;
        const aura = ctx.createRadialGradient(
          pointerClient.x,
          pointerClient.y,
          0,
          pointerClient.x,
          pointerClient.y,
          radius
        );
        aura.addColorStop(0, isDark ? 'rgba(220, 38, 38, 0.065)' : 'rgba(200, 16, 46, 0.045)');
        aura.addColorStop(1, 'transparent');
        ctx.fillStyle = aura;
        ctx.fillRect(
          pointerClient.x - radius,
          pointerClient.y - radius,
          radius * 2,
          radius * 2
        );
      }

      const isDesktop = w >= 1024;
      const cx = isDesktop
        ? w * 0.78 + smoothPointer.x * 14
        : w * 0.82;
      const cy = isDesktop
        ? h * 0.44 - smoothPointer.y * 12 - smoothScroll * 24
        : h * 0.68;
      const baseScale = Math.min(w, h) * (isDesktop ? 0.2 : 0.22) * (1 - smoothScroll * 0.04);
      const fov = 680;

      const project = (pt: Vec3, scale: number): [number, number, number] => {
        const px = pt[0] * scale;
        const py = pt[1] * scale;
        const pz = pt[2] * scale;
        const factor = fov / (fov + pz + 240);
        return [cx + px * factor, cy + py * factor, pz];
      };

      const rx = t * 0.55 + smoothPointer.y * 0.22 + smoothScroll * 0.42;
      const ry = t * 0.78 + smoothPointer.x * 0.28 + smoothScroll * 0.35;

      // Outer Dodecahedron
      ctx.strokeStyle = isDark
        ? `rgba(250, 249, 246, ${isDesktop ? 0.11 : 0.06})`
        : `rgba(11, 11, 13, ${isDesktop ? 0.095 : 0.05})`;
      ctx.lineWidth = 1.05;
      const outerProjected = DODECA_VERTICES.map((v) =>
        project(rotatePoint(v, rx, ry, t * 0.08), baseScale)
      );
      ctx.beginPath();
      for (const [a, b] of DODECA_EDGES) {
        ctx.moveTo(outerProjected[a][0], outerProjected[a][1]);
        ctx.lineTo(outerProjected[b][0], outerProjected[b][1]);
      }
      ctx.stroke();

      // Architectural diamond vertex markers on front-facing outer nodes (desktop only)
      if (isDesktop) {
        ctx.fillStyle = isDark ? 'rgba(220, 38, 38, 0.42)' : 'rgba(200, 16, 46, 0.32)';
        ctx.beginPath();
        const r = 2.3;
        for (const [vx, vy, vz] of outerProjected) {
          if (vz < 0) {
            ctx.moveTo(vx, vy - r);
            ctx.lineTo(vx + r, vy);
            ctx.lineTo(vx, vy + r);
            ctx.lineTo(vx - r, vy);
            ctx.closePath();
          }
        }
        ctx.fill();
      }

      // Inner Octahedron (Crimson)
      ctx.strokeStyle = isDark ? 'rgba(220, 38, 38, 0.29)' : 'rgba(200, 16, 46, 0.21)';
      ctx.lineWidth = 1.25;
      const innerProjected = OCTA_VERTICES.map((v) =>
        project(rotatePoint(v, -rx * 1.15, -ry * 1.15, t * 0.35), baseScale * 0.88)
      );
      ctx.beginPath();
      for (const [a, b] of OCTA_EDGES) {
        ctx.moveTo(innerProjected[a][0], innerProjected[a][1]);
        ctx.lineTo(innerProjected[b][0], innerProjected[b][1]);
      }
      ctx.stroke();

      // Primary Meridian Orbital Ring + Vernier Graduation Ticks
      ctx.strokeStyle = isDark ? 'rgba(220, 38, 38, 0.22)' : 'rgba(200, 16, 46, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const ringSegments = 72;
      for (let i = 0; i <= ringSegments; i++) {
        const theta = (i / ringSegments) * Math.PI * 2;
        const pt = rotatePoint(
          [Math.cos(theta) * 1.98, Math.sin(theta) * 1.98, 0],
          Math.PI / 2.5 + smoothPointer.y * 0.12 + smoothScroll * 0.16,
          smoothPointer.x * 0.14,
          t * 0.42
        );
        const [sx, sy] = project(pt, baseScale);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      if (isDesktop) {
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const theta = (i / 24) * Math.PI * 2;
          const innerR = i % 3 === 0 ? 1.88 : 1.94;
          const p1 = rotatePoint(
            [Math.cos(theta) * innerR, Math.sin(theta) * innerR, 0],
            Math.PI / 2.5 + smoothPointer.y * 0.12 + smoothScroll * 0.16,
            smoothPointer.x * 0.14,
            t * 0.42
          );
          const p2 = rotatePoint(
            [Math.cos(theta) * 2.02, Math.sin(theta) * 2.02, 0],
            Math.PI / 2.5 + smoothPointer.y * 0.12 + smoothScroll * 0.16,
            smoothPointer.x * 0.14,
            t * 0.42
          );
          const [x1, y1] = project(p1, baseScale);
          const [x2, y2] = project(p2, baseScale);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }

      // Counter-tilted secondary orbital ring
      ctx.strokeStyle = isDark ? 'rgba(250, 249, 246, 0.08)' : 'rgba(11, 11, 13, 0.06)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      for (let i = 0; i <= ringSegments; i++) {
        const theta = (i / ringSegments) * Math.PI * 2;
        const pt = rotatePoint(
          [Math.cos(theta) * 1.72, Math.sin(theta) * 1.72, 0],
          -Math.PI / 3.2 - smoothPointer.x * 0.1,
          Math.PI / 5 + smoothPointer.y * 0.1,
          -t * 0.35
        );
        const [sx, sy] = project(pt, baseScale);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="architectural-canvas"
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}
