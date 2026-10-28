import { cn } from "cn";
import { ClipboardList, Copy, Store } from "lucide-react";

import { useCopy } from "~/components/copy-context";
import { Logo } from "~/components/standalone-page";
import { rise } from "./rise";

const featureIcons = [
  { Icon: ClipboardList, className: "text-brand-sky" },
  { Icon: Copy, className: "text-brand-green" },
  { Icon: Store, className: "text-brand-red" },
];

/** Colonna del marchio: cosa fa FiscalBay, con i colori del logo. */
export function BrandPanel() {
  const t = useCopy().t.access;
  return (
    <aside className="relative hidden overflow-hidden bg-brand-navy text-white lg:flex lg:flex-col lg:gap-12 lg:p-12 xl:p-16">
      {/* Righe della tessera del logo, grandi e sfumate, come fondo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-16 grid rotate-[-8deg] gap-6 opacity-25"
      >
        <span className="h-8 w-[28rem] rounded-full bg-brand-sky" />
        <span className="h-8 w-80 rounded-full bg-brand-green" />
        <span className="h-8 w-40 rounded-full bg-brand-red" />
      </div>
      <Logo onDark className="relative h-8 w-fit" />
      <div className={cn("relative grid max-w-md gap-8", rise)}>
        <p className="text-3xl leading-tight font-semibold text-balance xl:text-4xl">
          {t.headline}
        </p>
        <ul className="grid gap-5">
          {t.features.map((feature, index) => {
            const { Icon, className } = featureIcons[index]!;
            return (
              <li key={feature.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10"
                >
                  <Icon className={cn("size-5", className)} />
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">{feature.title}</span>
                  <span className="text-sm leading-relaxed text-white/75">{feature.body}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
