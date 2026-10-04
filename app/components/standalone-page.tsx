import { cn } from "cn";
import type { ComponentType, SVGProps } from "react";

import logoDarkUrl from "../../docs/brand/logo/fiscalbay-logo-dark.svg?url";
import logoUrl from "../../docs/brand/logo/fiscalbay-logo.svg?url";
import { IconTile } from "~/components/icon-tile";
import type { TileTone } from "~/components/tile-tone";

/** Logo orizzontale nelle due versioni del tema; `onDark` per fondi sempre scuri. */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  if (onDark) {
    return <img src={logoDarkUrl} alt="FiscalBay" width="224" height="45" className={className} />;
  }
  return (
    <>
      <img
        src={logoUrl}
        alt="FiscalBay"
        width="224"
        height="45"
        className={cn(className, "dark:hidden")}
      />
      <img
        src={logoDarkUrl}
        alt="FiscalBay"
        width="224"
        height="45"
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}

/**
 * Pagine fuori dall'app: logo e riquadro nello stesso gruppo centrato.
 */
export function StandalonePage({
  icon,
  tone,
  title,
  homeHref,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: TileTone;
  title: string;
  homeHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-6 sm:px-8">
      <header className="mx-auto w-full max-w-2xl">
        <a
          href={homeHref}
          className="inline-block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <Logo className="h-7 w-auto" />
        </a>
      </header>
      <main className="grid w-full">
        <div className="grid animate-[rise-in_var(--duration-fast)_var(--ease-smooth-out)_both] gap-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <IconTile icon={icon} tone={tone} size="lg" />
            <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
