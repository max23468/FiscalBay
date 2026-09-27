import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Info,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";

/**
 * Semantica degli stati: il colore accompagna sempre icona e testo.
 * `neutral` indica un dato assente per natura, da non confondere con `danger`.
 */
export type StatusTone = "success" | "info" | "warning" | "danger" | "premium" | "neutral";

/**
 * `tinted` colora sempre la superficie; `sober` la colora solo per gli stati
 * che chiedono un'azione e lascia agli altri il colore della sola icona.
 */
export type StatusEmphasis = "tinted" | "sober";

const icons: Record<StatusTone, LucideIcon> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  premium: Sparkles,
  neutral: CircleDashed,
};

const iconColor: Record<StatusTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
  premium: "text-premium",
  neutral: "text-neutral",
};

// Nell'avviso la classe base colora l'icona come il testo: serve la priorità.
const alertIconColor: Record<StatusTone, string> = {
  success: "text-success!",
  info: "text-info!",
  warning: "text-warning!",
  danger: "text-danger!",
  premium: "text-premium!",
  neutral: "text-neutral!",
};

const actionable = new Set<StatusTone>(["warning", "danger", "premium"]);

export function StatusBadge({
  tone,
  emphasis = "tinted",
  children,
}: {
  tone: StatusTone;
  emphasis?: StatusEmphasis;
  children: React.ReactNode;
}) {
  const Icon = icons[tone];
  if (emphasis === "sober" && !actionable.has(tone)) {
    return (
      <Badge variant="outline" className="border-transparent px-0 text-muted-foreground">
        <Icon aria-hidden="true" data-icon="inline-start" className={iconColor[tone]} />
        {children}
      </Badge>
    );
  }
  return (
    <Badge variant={tone}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Badge>
  );
}

export function StatusAlert({
  tone,
  emphasis = "tinted",
  title,
  children,
}: {
  tone: StatusTone;
  emphasis?: StatusEmphasis;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Icon = icons[tone];
  const quiet = emphasis === "sober" && tone !== "danger" && tone !== "warning";
  return (
    <Alert variant={quiet ? "default" : tone} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" className={quiet ? alertIconColor[tone] : undefined} />
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}
