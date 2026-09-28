import { cn } from "cn";
import type { SVGProps } from "react";

/**
 * Ordine da sbloccare: la tessera del logo con due righe e una serratura.
 * Disegnata sulla griglia Lucide (24 px, tratto 2, estremi arrotondati) per
 * affiancarsi alle altre icone; distinta dalla corona del piano Premium.
 */
export function UnlockIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("icon-unlock", className)}
      {...props}
    >
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="m6 10h5" />
      <path d="m6 14h3" />
      <circle cx="16.5" cy="10.5" r="1.5" />
      <path d="m16.5 12v2.5" />
    </svg>
  );
}
