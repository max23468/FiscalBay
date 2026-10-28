import { AccountDeletionPage } from "~/components/account-deletion";
import type { Route } from "./+types/account-deletion";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath } from "../i18n";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)].accountDeletion;
  return [{ title: pageTitle(t.title) }, { name: "robots", content: "noindex" }];
}

export default function AccountDeletion({ matches }: Route.ComponentProps) {
  return <AccountDeletionPage language={matches[0]?.loaderData?.language ?? "it"} />;
}
