import { useEffect } from "react";
import { useRevalidator } from "react-router";

import { detectedTimeZone, timeZoneCookie } from "../preferences";

/** Il fuso del dispositivo arriva al server in un cookie; quando cambia, le date si rileggono. */
export function useDeviceTimeZone() {
  const revalidator = useRevalidator();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || detectedTimeZone(document.cookie) === zone) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${timeZoneCookie}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    void revalidator.revalidate();
  }, [revalidator]);
}
