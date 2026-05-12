"use client";

import { useEffect, useRef } from "react";

type ConfettiProps = {
  active: boolean;
  /** Total animation duration in ms. */
  durationMs?: number;
  /** Approximate number of particles to spawn. */
  count?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  shape: "rect" | "circle";
  life: number;
};

const COLORS = [
  "#0ea5e9", // sky-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
];

export function Confetti({ active, durationMs = 2800, count = 160 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas) return;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function spawnBurst(originX: number) {
      const W = w();
      const H = h();
      const burstCount = Math.floor(count / 2);
      for (let i = 0; i < burstCount; i++) {
        const angle = rand(-Math.PI * 0.75, -Math.PI * 0.25);
        const speed = rand(W * 0.35, W * 0.7);
        particlesRef.current.push({
          x: originX,
          y: H * 0.6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(6, 10),
          rot: rand(0, Math.PI * 2),
          vr: rand(-6, 6),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() < 0.65 ? "rect" : "circle",
          life: 1,
        });
      }
    }

    spawnBurst(w() * 0.2);
    spawnBurst(w() * 0.8);

    startRef.current = performance.now();
    const gravity = 1400;
    const drag = 0.995;

    function frame(now: number) {
      if (!ctx || !canvas) return;
      const elapsed = now - startRef.current;
      const dt = 1 / 60;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ps = particlesRef.current;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.vy += gravity * dt;
        p.vx *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const fadeStart = durationMs * 0.6;
        p.life =
          elapsed < fadeStart
            ? 1
            : Math.max(0, 1 - (elapsed - fadeStart) / (durationMs - fadeStart));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs) {
        rafRef.current = window.requestAnimationFrame(frame);
      } else {
        particlesRef.current = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    rafRef.current = window.requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, durationMs, count]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70]"
    />
  );
}
