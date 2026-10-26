import { Outlet, useMatches, type ShouldRevalidateFunctionArgs } from "react-router";

import { AccountShell } from "~/components/account-shell";
import { areaPage, requireAccountArea, shellData } from "../account-area.server";
import { revalidateUnlessSnapshot } from "../orders/order-list";
import type { Route } from "./+types/account";

/**
 * Shell dell'area reale, condivisa da Ordini, Negozi e Impostazioni: resta montata fra le
 * sezioni. Prima della conferma dell'email mostra soltanto gli Ordini; le altre pagine
 * rimandano lì dal proprio loader.
 */
export function loader({ request }: Route.LoaderArgs) {
  return areaPage(request, async () => {
    const area = await requireAccountArea(request, { unverified: true });
    return {
      userId: area.session.user.id,
      account: area.account,
      verified: area.session.user.emailVerified,
      shell: await shellData(area),
    };
  });
}

export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return revalidateUnlessSnapshot(args);
}

/** Ricerca attiva degli Ordini, decifrata dal loader della pagina; null nelle altre sezioni. */
function ordersSearch(matches: ReturnType<typeof useMatches>) {
  const orders = matches.find((match) => match.id === "routes/orders" || match.id === "orders-en");
  if (!orders) return null;
  const data = orders.loaderData as { page?: { search?: string | null } } | undefined;
  return data?.page?.search ?? "";
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const matches = useMatches();
  return (
    <AccountShell
      key={loaderData.userId}
      account={loaderData.account}
      shell={loaderData.shell}
      security={loaderData.verified}
      searchQuery={ordersSearch(matches)}
    >
      <Outlet />
    </AccountShell>
  );
}
