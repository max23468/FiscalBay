import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/**
 * Barra sul bordo inferiore dell'intestazione mentre la pagina successiva si carica. Compare
 * soltanto se l'attesa supera 150 ms, così le navigazioni rapide non lampeggiano; all'arrivo
 * si completa e svanisce. Il contenitore deve essere posizionato.
 */
export function NavigationProgress() {
  const loading = useNavigation().state === "loading";
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  if (loading && phase !== "loading") setPhase("loading");
  if (!loading && phase === "loading") setPhase("done");
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("idle"), 400);
    return () => clearTimeout(timer);
  }, [phase]);
  return <div aria-hidden="true" data-phase={phase} className="navigation-progress" />;
}
