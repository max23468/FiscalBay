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

const icons: Record<StatusTone, LucideIcon> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  premium: Sparkles,
  neutral: CircleDashed,
};

export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const Icon = icons[tone];
  return (
    <Badge variant={tone}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Badge>
  );
}

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
  return (
    <Alert variant={tone}>
      <Icon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}
