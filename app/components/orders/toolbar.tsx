import { cn } from "cn";
import { ListChecks, SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useAction } from "~/components/app-shell";
import { StatusIcon } from "~/components/status";
import { Button } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { AppCopy } from "../../app-copy";
import { rememberStore, withoutListPosition } from "../../order-list";
import { searchParam } from "../../order-search";
import {
  fiscalSituations,
  marketplaceLabel,
  paymentStatuses,
  shippingStatuses,
  type Plan,
} from "../../view-models";

interface FilterOption {
  value: string;
  label: string;
  /** Opzione del piano Premium: visibile con la corona ma non selezionabile. */
  premium?: boolean;
}

function FilterSelect({
  label,
  name,
  value,
  options,
  allLabel,
  premiumLabel,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
  allLabel: string;
  premiumLabel: string;
  onChange: (name: string, value: string) => void;
}) {
  const id = useId();
  const items: FilterOption[] = [{ value: "", label: allLabel }, ...options];
  // Un valore sconosciuto nell'URL vale come «Tutti», come fa il server.
  const current = items.some((item) => item.value === value && !item.premium) ? value : "";
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={current} onValueChange={(next) => onChange(name, next ?? "")}>
        <SelectTrigger id={id} className="w-full min-w-0">
          {/* Un valore più lungo del campo si tronca con i puntini; il menu lo mostra intero. */}
          <SelectValue className="min-w-0">
            {(selected: string) => (
              <span className="truncate">
                {items.find((item) => item.value === selected)?.label ?? allLabel}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        {/*
          Largo quanto la voce più lunga, mai meno del campo, fino a 24rem ed entro il margine
          laterale della pagina: un nome di negozio molto lungo va a capo.
        */}
        <SelectContent
          collisionPadding={16}
          className="w-max max-w-[min(var(--available-width),24rem)] min-w-(--anchor-width)"
        >
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} disabled={item.premium}>
              {item.label}
              {item.premium ? (
                <>
                  <StatusIcon tone="premium" className="ml-auto" />
                  <span className="text-xs">{premiumLabel}</span>
                </>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Filtri dell'elenco nell'URL, modalità Seleziona e ripristino della conferma di sblocco. */
export function OrdersToolbar({
  empty,
  stores,
  marketplaces,
  plan,
  confirmUnlock,
  t,
  selecting,
  onToggleSelect,
  selectRef,
}: {
  empty: boolean;
  stores: Array<{ id: string; name: string }>;
  marketplaces: string[];
  plan: Plan;
  confirmUnlock?: boolean;
  t: AppCopy;
  selecting: boolean;
  onToggleSelect: () => void;
  selectRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const action = useAction();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterKeys = ["negozio", "marketplace", "periodo", "pagamento", "spedizione", "fiscale"];
  const active = filterKeys.filter((key) => params.get(key)).length;
  // Un filtro diverso apre un nuovo elenco, dall'inizio e con una nuova istantanea.
  const change = (name: string, value: string) => {
    const next = withoutListPosition(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name === "negozio") rememberStore(value || null);
    setParams(next, { preventScrollReset: true });
  };
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2 md:order-last md:shrink-0">
        {confirmUnlock === false ? (
          <Button
            variant="outline"
            size="sm"
            disabled={action.pending}
            onClick={() => action.run("unlock-confirmation")}
          >
            {t.orders.restoreUnlockConfirmation}
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="mr-auto md:hidden"
          aria-expanded={filtersOpen}
          aria-controls="orders-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
          {t.orders.filters}
          {active > 0 ? <span className="font-code">({active})</span> : null}
        </Button>
        <Button
          variant={selecting ? "secondary" : "outline"}
          ref={selectRef}
          aria-pressed={selecting}
          disabled={empty && !selecting}
          focusableWhenDisabled
          onClick={onToggleSelect}
        >
          <ListChecks aria-hidden="true" data-icon="inline-start" />
          {t.orders.select}
        </Button>
      </div>
      <div
        id="orders-filters"
        className={cn(
          // Due colonne anche su smartphone: i filtri aperti lasciano in vista i primi risultati.
          "grid grid-cols-2 gap-3 md:flex-1 md:grid-cols-3 xl:grid-cols-6",
          !filtersOpen && "max-md:hidden",
        )}
      >
        {stores.length > 1 ? (
          <FilterSelect
            label={t.orders.store}
            name="negozio"
            value={params.get("negozio") ?? ""}
            options={stores.map((store) => ({ value: store.id, label: store.name }))}
            allLabel={t.orders.all}
            premiumLabel={t.orders.premiumOption}
            onChange={change}
          />
        ) : null}
        {marketplaces.length > 1 ? (
          <FilterSelect
            label={t.orders.marketplace}
            name="marketplace"
            value={params.get("marketplace") ?? ""}
            options={marketplaces.map((id) => ({ value: id, label: marketplaceLabel(id) }))}
            allLabel={t.orders.all}
            premiumLabel={t.orders.premiumOption}
            onChange={change}
          />
        ) : null}
        <FilterSelect
          label={t.orders.period}
          name="periodo"
          value={params.get("periodo") ?? ""}
          options={[
            { value: "7", label: t.orders.last7 },
            { value: "30", label: t.orders.last30 },
            { value: "90", label: t.orders.last90, premium: plan !== "premium" },
          ]}
          allLabel={t.orders.all}
          premiumLabel={t.orders.premiumOption}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.paymentStatus}
          name="pagamento"
          value={params.get("pagamento") ?? ""}
          options={paymentStatuses.map((status) => ({
            value: status,
            label: t.orders.payment[status],
          }))}
          allLabel={t.orders.all}
          premiumLabel={t.orders.premiumOption}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.shippingStatus}
          name="spedizione"
          value={params.get("spedizione") ?? ""}
          options={shippingStatuses.map((status) => ({
            value: status,
            label: t.orders.shipping[status],
          }))}
          allLabel={t.orders.all}
          premiumLabel={t.orders.premiumOption}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.fiscalStatus}
          name="fiscale"
          value={params.get("fiscale") ?? ""}
          options={fiscalSituations.map((situation) => ({
            value: situation,
            label: t.orders.fiscal[situation],
          }))}
          allLabel={t.orders.all}
          premiumLabel={t.orders.premiumOption}
          onChange={change}
        />
      </div>
    </div>
  );
}

/** Ricerca attiva, con la possibilità di toglierla quando non lascerebbe la pagina vuota. */
export function SearchChip({
  t,
  query,
  clearable = true,
}: {
  t: AppCopy;
  query: string | null;
  clearable?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  if (!query) return null;
  return (
    <p className="-mt-2 flex items-center gap-2 text-sm">
      <span className="text-pretty break-words">{t.orders.searchActive(query)}</span>
      {clearable ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.orders.clearSearch}
          onClick={() => {
            const next = withoutListPosition(new URLSearchParams(location.search));
            next.delete(searchParam);
            void navigate({ search: next.toString() }, { preventScrollReset: true });
          }}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </p>
  );
}
