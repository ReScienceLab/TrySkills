"use client";

import { useRef, useEffect, useCallback } from "react";

interface GlowNode {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  brightness: number;
  targetBrightness: number;
  phase: number;
  speed: number;
  radius: number;
  drift: number;
}

export function GlowMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GlowNode[]>([]);
  const maskRef = useRef<HTMLImageElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);
  const visibleRef = useRef(true);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;

    const nodes: GlowNode[] = [];
    const count = 25;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      nodes.push({
        x, y, originX: x, originY: y,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        brightness: 0, targetBrightness: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.006,
        radius: 200 + Math.random() * 300,
        drift: 200 + Math.random() * 250,
      });
    }
    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches; };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(canvas);
    const handleVisibility = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/bg.svg";
    img.onload = () => { maskRef.current = img; };
    img.onerror = () => { maskRef.current = null; };
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      mouseRef.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      };
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useEffect(() => {
    init();
    window.addEventListener("resize", init);

    const animate = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      if (reducedMotionRef.current || !visibleRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio;
      const time = Date.now() * 0.001;
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        const dxO = node.x - node.originX;
        const dyO = node.y - node.originY;
        const distO = Math.sqrt(dxO * dxO + dyO * dyO);
        if (distO > node.drift) {
          node.vx -= (dxO / distO) * 0.1;
          node.vy -= (dyO / distO) * 0.1;
        }
        node.vx += (Math.random() - 0.5) * 0.06;
        node.vy += (Math.random() - 0.5) * 0.06;
        const spd = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (spd > 2.2) {
          node.vx *= 2.2 / spd;
          node.vy *= 2.2 / spd;
        }
        node.targetBrightness = (Math.sin(time * node.speed * 60 + node.phase) + 1) * 0.5;
        node.brightness += (node.targetBrightness - node.brightness) * 0.015;
      }

      const connectionDist = 350 * dpr;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * Math.min(nodes[i].brightness, nodes[j].brightness) * 0.25;
            if (alpha > 0.01) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.strokeStyle = `rgba(80, 160, 255, ${alpha})`;
              ctx.lineWidth = 1.5 * dpr;
              ctx.stroke();
            }
          }
        }
      }

      for (const node of nodes) {
        if (node.brightness > 0.03) {
          const r = node.radius * dpr;
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
          gradient.addColorStop(0, `rgba(80, 160, 255, ${node.brightness * 0.45})`);
          gradient.addColorStop(0.3, `rgba(0, 100, 220, ${node.brightness * 0.2})`);
          gradient.addColorStop(1, "rgba(0, 71, 171, 0)");
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      const mouseRadius = 250 * dpr;
      const mouseGradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouseRadius);
      mouseGradient.addColorStop(0, "rgba(100, 180, 255, 0.5)");
      mouseGradient.addColorStop(0.3, "rgba(60, 140, 255, 0.2)");
      mouseGradient.addColorStop(1, "rgba(0, 71, 171, 0)");
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouseRadius, 0, Math.PI * 2);
      ctx.fillStyle = mouseGradient;
      ctx.fill();

      if (maskRef.current) {
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(maskRef.current, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(rafRef.current);
    };
  }, [init]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
