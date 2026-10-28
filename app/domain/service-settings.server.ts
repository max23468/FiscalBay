import { z } from "zod";

/**
 * Interruttori e soglie dei servizi (§15, §32), configurati dalla console senza deploy. Ogni
 * impostazione ha un tipo e un predefinito sicuro, il comportamento normale del servizio: senza
 * la riga, o con un valore non valido, vale il predefinito. Una modifica vale dal momento della
 * conferma, non è retroattiva e non tocca cicli, diritti o prezzi. Lista d'attesa e acquisti
 * restano in `admission_settings`, letti dalle stesse query di diritti, letture e acquisti.
 */

const settings = {
  /**
   * Chiamate a eBay per i negozi: letture, dettagli, conferme degli ordini, rinnovi dei token e
   * collegamenti. Spente, le richieste restano registrate e partono alla riaccensione; i
   * webhook di eBay si ricevono comunque.
   */
  ebay_calls: { schema: z.boolean(), fallback: true },
  /**
   * Invii del bot Telegram ai venditori: notifiche, riepiloghi, risposte ai comandi e menu.
   * Spenti, le notifiche restano in attesa e i comandi ricevuti non hanno risposta. Il Control
   * Center dell'owner, comandi e avvisi, resta attivo.
   */
  telegram_sends: { schema: z.boolean(), fallback: true },
  /** Percentuale del consumo giornaliero di una quota eBay che apre l'anomalia (D188). */
  quota_attention: { schema: z.number().int().min(50).max(85), fallback: 70 },
} as const;

export type ServiceSetting = keyof typeof settings;
export type ServiceSettings = {
  [Name in ServiceSetting]: z.infer<(typeof settings)[Name]["schema"]>;
};
export type ServiceSwitch = "ebay_calls" | "telegram_sends";

/** Interruttore acceso, in SQL: senza la riga vale acceso. */
export function switchOnSql(name: ServiceSwitch) {
  return `NOT EXISTS (SELECT 1 FROM service_settings WHERE name = '${name}' AND value = 'false')`;
}

function parsed<Name extends ServiceSetting>(name: Name, value: string | undefined) {
  if (value === undefined) return settings[name].fallback as ServiceSettings[Name];
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return settings[name].fallback as ServiceSettings[Name];
  }
  const result = settings[name].schema.safeParse(json);
  return (result.success ? result.data : settings[name].fallback) as ServiceSettings[Name];
}

/** Valore in vigore di un'impostazione. */
export async function serviceSetting<Name extends ServiceSetting>(db: D1Database, name: Name) {
  const row = await db
    .prepare("SELECT value FROM service_settings WHERE name = ?")
    .bind(name)
    .first<{ value: string }>();
  return parsed(name, row?.value);
}

export type SettingState<Value> = { value: Value; since: string | null };

export type Switchboard = {
  waitlist: SettingState<boolean>;
  purchases: SettingState<boolean>;
  ebay: SettingState<boolean>;
  telegram: SettingState<boolean>;
  quotaAttention: SettingState<number>;
  /** Account in lista d'attesa, dal primo arrivato. */
  waiting: { workspaceId: string; email: string; waitlistedAt: string }[];
  waitingTotal: number;
};

/** Account in lista d'attesa mostrati nella console. */
const waitingLimit = 50;

/** Stato di interruttori, soglie e lista d'attesa per la console. */
export async function switchboard(db: D1Database): Promise<Switchboard> {
  const [{ results: rows }, { results: admission }, { results: waiting }, { results: total }] =
    await db.batch<Record<string, string | number | null>>([
      db.prepare("SELECT name, value, updated_at FROM service_settings"),
      db.prepare("SELECT free_waitlist, purchases_open, updated_at FROM admission_settings"),
      db
        .prepare(`SELECT wm.workspace_id AS workspaceId, u."email" AS email,
            p.waitlisted_at AS waitlistedAt
          FROM user_profiles p JOIN "user" u ON u."id" = p.user_id
          JOIN workspace_members wm ON wm.user_id = p.user_id
          WHERE p.waitlisted_at IS NOT NULL ORDER BY p.waitlisted_at, wm.workspace_id LIMIT ?`)
        .bind(waitingLimit),
      db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE waitlisted_at IS NOT NULL"),
    ]);
  const stored = new Map(
    (rows as { name: string; value: string; updated_at: string }[]).map((row) => [row.name, row]),
  );
  const state = <Name extends ServiceSetting>(name: Name) => ({
    value: parsed(name, stored.get(name)?.value),
    since: stored.get(name)?.updated_at ?? null,
  });
  const flags = admission[0] as
    | { free_waitlist: number; purchases_open: number; updated_at: string }
    | undefined;
  return {
    waitlist: { value: flags?.free_waitlist === 1, since: flags?.updated_at ?? null },
    purchases: { value: flags?.purchases_open !== 0, since: flags?.updated_at ?? null },
    ebay: state("ebay_calls"),
    telegram: state("telegram_sends"),
    quotaAttention: state("quota_attention"),
    waiting: waiting as Switchboard["waiting"],
    waitingTotal: Number(total[0]?.count ?? 0),
  };
}

export type SwitchName = "free_waitlist" | "purchases_open" | ServiceSwitch;

export function isSwitchName(value: string): value is SwitchName {
  return ["free_waitlist", "purchases_open", "ebay_calls", "telegram_sends"].includes(value);
}

/**
 * Accende o spegne un interruttore. Spegnere la lista d'attesa ammette subito chi era in
 * attesa, in modo definitivo come il compito dell'inattività (D201).
 */
export async function setSwitch(
  db: D1Database,
  name: SwitchName,
  on: boolean,
  now = new Date(),
): Promise<"done" | "unchanged"> {
  const at = now.toISOString();
  if (name === "free_waitlist" || name === "purchases_open") {
    const current = await switchboard(db);
    if ((name === "free_waitlist" ? current.waitlist : current.purchases).value === on)
      return "unchanged";
    const value = on ? 1 : 0;
    await db.batch([
      // Senza la riga valgono nessuna lista d'attesa e acquisti aperti.
      db
        .prepare(`INSERT INTO admission_settings (id, free_waitlist, purchases_open, updated_at)
          VALUES (1, ?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET ${name} = ?4, updated_at = ?3`)
        .bind(
          name === "free_waitlist" ? value : 0,
          name === "purchases_open" ? value : 1,
          at,
          value,
        ),
      ...(name === "free_waitlist" && !on
        ? [
            db.prepare(
              "UPDATE user_profiles SET waitlisted_at = NULL WHERE waitlisted_at IS NOT NULL",
            ),
          ]
        : []),
    ]);
    return "done";
  }
  if ((await serviceSetting(db, name)) === on) return "unchanged";
  await saveSetting(db, name, on, at);
  return "done";
}

async function saveSetting(db: D1Database, name: ServiceSetting, value: unknown, at: string) {
  await db
    .prepare(`INSERT INTO service_settings (name, value, updated_at) VALUES (?1, ?2, ?3)
      ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(name, JSON.stringify(value), at)
    .run();
}

/** Soglia di attenzione delle quote eBay, in percentuale del consumo giornaliero. */
export async function setQuotaAttention(
  db: D1Database,
  percent: number,
  now = new Date(),
): Promise<"done" | "unchanged" | "invalid"> {
  const value = settings.quota_attention.schema.safeParse(percent);
  if (!value.success) return "invalid";
  if ((await serviceSetting(db, "quota_attention")) === value.data) return "unchanged";
  await saveSetting(db, "quota_attention", value.data, now.toISOString());
  return "done";
}

/**
 * Ammissione di uno spazio in lista d'attesa: i suoi membri escono dall'attesa e le letture
 * riprendono con la cadenza del piano. Nessun effetto su prova, quota o acquisti.
 */
export async function admitWorkspace(db: D1Database, workspaceId: string) {
  const result = await db
    .prepare(`UPDATE user_profiles SET waitlisted_at = NULL WHERE waitlisted_at IS NOT NULL
      AND user_id IN (SELECT user_id FROM workspace_members WHERE workspace_id = ?)`)
    .bind(workspaceId)
    .run();
  return result.meta.changes > 0 ? "done" : "not_found";
}
