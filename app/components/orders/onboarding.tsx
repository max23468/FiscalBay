import { cn } from "cn";
import { Check, Plus } from "lucide-react";
import { Link } from "react-router";

import { useAction } from "~/components/action";
import { useCopy, useLinks } from "~/components/copy-context";
import { EmptyState } from "~/components/empty-state";
import { useDate } from "~/components/time-zone";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { appHref } from "../../app-links";
import type { OrdersPageData } from "./page";

/** Collegamento del primo negozio: pagina reale, azione simulata o, finché non è possibile, nessuna. */
function ConnectAction({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  const action = useAction();
  const content = (
    <>
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.orders.connectStore}
    </>
  );
  if (data.connectHref === null) return null;
  if (data.connectHref)
    return (
      <Link to={data.connectHref} {...buttonLink()}>
        {content}
      </Link>
    );
  return <Button onClick={() => action.run("store-connect")}>{content}</Button>;
}

/** Primi passi: compaiono finché la prima sincronizzazione non è conclusa, dal punto raggiunto. */
function OnboardingSteps({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  const current = data.onboarding.findIndex((step) => !step.done);
  return (
    <section aria-labelledby="onboarding" className="grid gap-2 border-t pt-4">
      <h3 id="onboarding" className="text-xs font-medium text-muted-foreground">
        {t.orders.steps}
      </h3>
      <ol className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {data.onboarding.map((step, index) => (
          <li
            key={step.label}
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              !step.done && index !== current && "text-muted-foreground",
              index === current && "font-medium",
            )}
          >
            {step.done ? (
              <Check aria-hidden="true" className="size-4 text-success" />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  "font-code grid size-4 place-items-center rounded-full text-[0.625rem]",
                  index === current ? "bg-primary text-primary-foreground" : "border",
                )}
              >
                {index + 1}
              </span>
            )}
            {t.orders[step.label]}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FirstUse({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  return (
    <EmptyState
      title={t.orders.firstUseTitle}
      description={t.orders.firstUseBody}
      action={<ConnectAction data={data} />}
    >
      <OnboardingSteps data={data} />
    </EmptyState>
  );
}

/** Negozio collegato senza ordini: in attesa della prima lettura o senza ordini nel periodo. */
export function NoOrders({ data }: { data: OrdersPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const date = useDate();
  return (
    <EmptyState
      variant="all-clear"
      title={
        data.sync.lastAt ? t.orders.noOrdersTitle(data.sync.historyDays) : t.orders.firstSyncTitle
      }
      description={
        data.sync.lastAt
          ? t.orders.noOrdersBody(data.sync.storeName ?? "", date(data.sync.lastAt))
          : t.orders.firstSyncBody(data.sync.storeName ?? "")
      }
      action={
        data.sync.storeId ? (
          <Link
            to={appHref(links, `negozi/${data.sync.storeId}`)}
            {...buttonLink({ variant: "outline" })}
          >
            {t.orders.openStore}
          </Link>
        ) : undefined
      }
    >
      {data.sync.lastAt ? null : <OnboardingSteps data={data} />}
    </EmptyState>
  );
}
