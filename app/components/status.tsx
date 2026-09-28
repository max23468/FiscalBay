import { CircleAlert, CircleCheck, CircleDashed, Crown, Info, TriangleAlert } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "cn";

import { UnlockIcon } from "~/components/icons";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";

import type { StatusTone } from "../view-models";

const icons: Record<StatusTone, ComponentType<SVGProps<SVGSVGElement>>> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  premium: Crown,
  locked: UnlockIcon,
  neutral: CircleDashed,
};

const iconColor: Record<StatusTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
  premium: "text-premium",
  locked: "text-premium",
  neutral: "text-neutral",
};

// Nell'avviso la classe base colora l'icona come il testo: serve la priorità.
const alertIconColor: Record<StatusTone, string> = {
  success: "text-success!",
  info: "text-info!",
  warning: "text-warning!",
  danger: "text-danger!",
  premium: "text-premium!",
  locked: "text-premium!",
  neutral: "text-neutral!",
};

const actionable = new Set<StatusTone>(["warning", "danger", "locked"]);

/** Icona decorativa del tono, per elenchi in cui il testo accanto porta il significato. */
export function StatusIcon({ tone, className }: { tone: StatusTone; className?: string }) {
  const Icon = icons[tone];
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", iconColor[tone], className)} />;
}

/** Superficie colorata solo per gli stati che chiedono un'azione. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const Icon = icons[tone];
  if (!actionable.has(tone)) {
    return (
      <Badge variant="outline" className="border-transparent px-0 text-muted-foreground">
        <Icon aria-hidden="true" data-icon="inline-start" className={iconColor[tone]} />
        {children}
      </Badge>
    );
  }
  return (
    <Badge variant={tone === "locked" ? "premium" : tone}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Badge>
  );
}

/** Sfondo colorato solo per errore e attenzione; gli altri avvisi colorano l'icona. */
export function StatusAlert({
  tone,
  title,
  children,
}: {
  tone: StatusTone;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Icon = icons[tone];
  const quiet = tone !== "danger" && tone !== "warning";
  return (
    <Alert variant={quiet ? "default" : tone} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" className={quiet ? alertIconColor[tone] : undefined} />
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}

/**
 * Funzione del piano Premium non inclusa nel piano attuale: la corona la
 * segnala una volta, accanto alla spiegazione, invece che su ogni riga.
 */
export function PremiumNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-sm leading-relaxed text-pretty text-muted-foreground">
      <StatusIcon tone="premium" className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}
