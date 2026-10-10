"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sol: light. Luna: dark. Auto: sigue al sistema.
// Click cicla: auto → light → dark → auto.
// useState "mounted" evita el mismatch de hidratación: el HTML del servidor
// y el cliente deben coincidir en el primer render, y el tema solo se conoce
// en el cliente. Hasta entonces, renderizamos un placeholder.
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="w-9 h-9 opacity-0" />;
  }

  const mode = theme === "system" ? "auto" : (resolvedTheme === "dark" ? "dark" : "light");
  const next = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-9 h-9 relative"
      onClick={() => setTheme(next === "auto" ? "system" : next)}
      title={`Theme: ${mode} (click → ${next})`}
    >
      <span className={cn("text-lg transition-opacity", mode !== "auto" ? "opacity-100" : "opacity-40")}>
        {mode === "dark" ? "🌙" : "☀️"}
      </span>
      {mode === "auto" && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold">A</span>
      )}
    </Button>
  );
}