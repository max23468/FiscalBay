import { useLocation, useNavigation } from "react-router";

import { pendingList } from "../../orders/order-list";

/** Parametri dell'elenco in arrivo, o di quello mostrato, e se i criteri stanno cambiando. */
export function usePendingList() {
  const location = useLocation();
  const navigation = useNavigation();
  const { search, changing } = pendingList(
    location,
    navigation.state === "loading" ? navigation.location : undefined,
  );
  return { params: new URLSearchParams(search), changing };
}
