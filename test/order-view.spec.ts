import { describe, expect, it } from "vitest";
import { orderCriteria, type VisibleOrder } from "../app/domain/orders.server";
import { orderView } from "../app/domain/order-view.server";
import { now } from "./fixtures/database-fixtures";
import { addressRows } from "../app/view-models";
import {
  addressCase,
  buyerNameView,
  contactsView,
  emailView,
  mailtoHref,
  phoneView,
} from "../app/contact";
import { billingCopyText, missingContact } from "../app/components/orders/labels";
import { appCopy } from "../app/app-copy";

describe("vista condivisa e criteri degli ordini", () => {
  const base: VisibleOrder = {
    id: "o",
    ebayOrderId: "12-00000-00000",
    creationTime: now,
    lastModifiedTime: now,
    currency: "EUR",
    totalMinor: 1000,
    storeId: "s",
    storeName: "Negozio",
    marketplaceId: null,
    provisional: false,
    summary: {
      buyer: null,
      orderPaymentStatus: null,
      orderFulfillmentStatus: null,
      payment: null,
      shipping: null,
      lineItems: [],
    },
    fiscalState: "locked",
    taxVerification: "completed",
    taxAvailability: "present",
    taxCheckedAt: null,
    firstTaxAvailableAt: null,
    lockedShownAs: "CF",
    reconciliationIssue: false,
    taxIdentifiers: [],
  };
  const view = (order: Partial<VisibleOrder>) => orderView({ ...base, ...order });
  const cf = {
    type: "CODICE_FISCALE",
    issuingCountry: null,
    value: "RSSMRA80A01H501U",
    source: "ebay_fulfillment",
    observedAt: now,
    quality: "valid" as const,
    updated: false,
  };

  it("collega l'inserzione soltanto da un'identità di riga che inizia con il suo ID", () => {
    const listing = (stableKey: string | null) =>
      view({
        summary: {
          ...base.summary,
          lineItems: [
            {
              lineItemId: "riga",
              title: "Articolo",
              quantity: 1,
              sku: null,
              totalMinor: null,
              currency: null,
              imageUrl: null,
              stableKey,
            },
          ],
        },
      }).items[0]!.listingId;
    expect(listing("110000000099-9001")).toBe("110000000099");
    expect(listing("123456-1")).toBe("123456");
    expect(listing("1234567890123456789-1")).toBe("1234567890123456789");
    // Troppe o troppo poche cifre, un prefisso estraneo o il trattino mancante non sono un ID.
    expect(listing("12345-1")).toBeNull();
    expect(listing("12345678901234567890-1")).toBeNull();
    expect(listing("x110000000099-1")).toBeNull();
    expect(listing("110000000099")).toBeNull();
    expect(listing("11000a000099-1")).toBeNull();
    expect(listing(null)).toBeNull();
  });

  it("riporta la condizione dell'ultima lettura accanto a un valore disponibile", () => {
    const available = (
      taxVerification: VisibleOrder["taxVerification"],
      taxAvailability: VisibleOrder["taxAvailability"],
    ) =>
      view({ fiscalState: "available", taxVerification, taxAvailability, taxIdentifiers: [cf] })
        .fiscal;
    const identifier = { type: "CF", value: "RSSMRA80A01H501U", quality: "valid", updated: false };
    expect(available("completed", "present")).toEqual({
      state: "available",
      identifiers: [identifier],
    });
    expect(available("error", "present")).toMatchObject({ notice: "lastKnown" });
    expect(available("checking", "masked")).toMatchObject({ notice: "checking" });
    expect(available("completed", "masked")).toMatchObject({ notice: "masked" });
    expect(available("completed", "absent")).toMatchObject({ notice: "notReturned" });
    expect(available("completed", "not_included")).toMatchObject({ notice: "notReturned" });
    expect(available("completed", "removed")).not.toHaveProperty("notice");
    // Un tipo estero conserva il nome originale; quelli italiani no.
    expect(
      view({
        fiscalState: "available",
        taxIdentifiers: [{ ...cf, type: "NIF", issuingCountry: "ES", quality: "unchecked" }],
      }).fiscal,
    ).toEqual({
      state: "available",
      identifiers: [
        {
          type: "OTHER",
          typeLabel: "NIF",
          value: "RSSMRA80A01H501U",
          quality: "unchecked",
          updated: false,
        },
      ],
    });
  });

  it("sospende lo sblocco durante una nuova verifica", () => {
    expect(view({}).fiscal).toEqual({ state: "locked", shownAs: "CF" });
    expect(view({ taxVerification: "checking" }).fiscal).toEqual({
      state: "locked",
      shownAs: "CF",
      hold: "checking",
    });
    expect(view({ fiscalState: "missing", taxAvailability: "masked" }).fiscal).toEqual({
      state: "missing",
      reason: "masked",
    });
    expect(view({ fiscalState: "missing", taxAvailability: "removed" }).fiscal).toEqual({
      state: "missing",
      reason: "removed",
    });
    expect(view({ fiscalState: "missing", taxAvailability: "absent" }).fiscal).toEqual({
      state: "missing",
    });
    // Senza dato, l'acquirente estero ha un motivo proprio.
    const billedIn = (countryCode: string) =>
      ({
        ...base.summary,
        buyer: { billingAddress: { countryCode } },
      }) as VisibleOrder["summary"];
    const foreign = { fiscalState: "foreign", taxAvailability: "not_included" } as const;
    expect(view({ ...foreign, summary: billedIn("ES") }).fiscal).toEqual({
      state: "missing",
      reason: "foreign",
      country: "ES",
    });
    expect(
      view({ fiscalState: "missing", taxAvailability: "not_included", summary: billedIn("IT") })
        .fiscal,
    ).toEqual({ state: "missing" });
    expect(
      view({ fiscalState: "missing", taxAvailability: "masked", summary: billedIn("ES") }).fiscal,
    ).toEqual({ state: "missing", reason: "masked" });
    expect(view({ fiscalState: "checking" }).fiscal).toEqual({ state: "checking" });
    expect(view({ fiscalState: "error" }).fiscal).toEqual({ state: "error" });
  });

  it("compone stati, contatti, indirizzi e righe senza inventare dati assenti", () => {
    const address = {
      addressLine1: "Via Roma 1",
      addressLine2: null,
      city: "Trento",
      postalCode: null,
      stateOrProvince: null,
      countryCode: "IT",
    };
    const summary = (changes: Partial<VisibleOrder["summary"]>) => ({
      ...base.summary,
      ...changes,
    });
    const buyer = (changes: object) =>
      ({
        username: null,
        name: null,
        email: null,
        phone: null,
        billingAddress: null,
        shipTo: null,
        ...changes,
      }) as VisibleOrder["summary"]["buyer"];
    const empty = view({});
    expect(empty).toMatchObject({
      buyerName: null,
      buyerUsername: null,
      shipTo: null,
      billingAddress: null,
      phone: null,
      email: null,
      payment: { status: null, code: null },
      shipping: { status: null, code: null },
      suggestions: [],
      lastSyncedAt: null,
      updatedAt: now,
    });
    expect(empty).not.toHaveProperty("suggestionStatus");
    expect(empty).not.toHaveProperty("reconciliationIssue");
    expect(empty).not.toHaveProperty("thumbnail");
    const order = view({
      reconciliationIssue: true,
      suggestions: [],
      suggestionStatus: "none",
      summary: summary({
        payment: "unknown",
        orderPaymentStatus: "AWAITING",
        shipping: "shipped",
        orderFulfillmentStatus: "FULFILLED",
        buyer: buyer({
          billingAddress: address,
          shipTo: { name: "Mario", phone: "+39 1", address: { ...address, city: "Rovereto" } },
        }),
        lineItems: [
          {
            lineItemId: "a",
            title: "A",
            quantity: 2,
            sku: null,
            totalMinor: 300,
            currency: "USD",
            imageUrl: null,
            stableKey: null,
          },
          {
            lineItemId: "b",
            title: "B",
            quantity: 1,
            sku: "S",
            totalMinor: 200,
            currency: "EUR",
            imageUrl: "https://i.ebayimg.com/b.jpg",
            stableKey: null,
          },
        ],
      }),
    });
    expect(order).toMatchObject({
      payment: { status: null, code: "AWAITING" },
      shipping: { status: "shipped" },
      shipTo: { name: "Mario", locality: "Rovereto", country: "IT" },
      // Senza seconda riga né CAP: nessun separatore o valore inventato.
      billingAddress: {
        line: "Via Roma 1",
        postalCode: "",
        city: "Trento",
        province: null,
        countryCode: "IT",
      },
      // Senza telefono dell'acquirente vale quello del destinatario.
      phone: "+39 1",
      reconciliationIssue: true,
      suggestionStatus: "none",
      thumbnail: "https://i.ebayimg.com/b.jpg",
      // Un importo in un'altra valuta non si mostra come se fosse in euro.
      items: [
        { id: "a", totalMinor: null, currency: "EUR" },
        { id: "b", totalMinor: 200, currency: "EUR" },
      ],
    });
    expect(order.shipping).toEqual({ status: "shipped" });
    // Un indirizzo parziale conserva i campi disponibili senza dedurre quelli assenti.
    for (const billing of [
      { ...address, city: null },
      { ...address, countryCode: null },
      { ...address, addressLine1: null },
    ])
      expect(
        view({ summary: summary({ buyer: buyer({ billingAddress: billing }) }) }).billingAddress,
      ).not.toBeNull();
    expect(
      view({
        summary: summary({
          buyer: buyer({ billingAddress: { ...address, city: null, countryCode: null } }),
        }),
      }).billingAddress,
    ).toMatchObject({ line: "Via Roma 1", city: "", countryCode: "" });
    expect(
      view({
        summary: summary({
          buyer: buyer({
            billingAddress: { ...address, addressLine1: "  ", city: " ", countryCode: "  " },
          }),
        }),
      }).billingAddress,
    ).toBeNull();
    expect(
      view({
        summary: summary({
          buyer: buyer({
            billingAddress: { ...address, addressLine1: null, addressLine2: "Scala B" },
          }),
        }),
      }).billingAddress,
    ).toMatchObject({ line: "Scala B" });
    expect(
      view({
        summary: summary({ buyer: buyer({ shipTo: { name: null, phone: null, address: null } }) }),
      }).shipTo,
    ).toEqual({ name: null, locality: null, country: null });
    expect(
      view({
        summary: summary({
          buyer: buyer({
            shipTo: { name: null, phone: null, address: { ...address, city: null } },
          }),
        }),
      }).shipTo,
    ).toEqual({ name: null, locality: null, country: "IT" });
    expect(
      view({
        summary: summary({
          buyer: buyer({
            shipTo: { name: null, phone: null, address: { ...address, stateOrProvince: "TN" } },
          }),
        }),
      }).shipTo?.locality,
    ).toBe("Trento (TN)");
  });

  it("formatta telefono, email e indirizzo senza correggere il dato di eBay", () => {
    // Telefono: prefisso dal Paese quando manca, cellulari italiani raggruppati.
    expect(phoneView("3331234567", "IT")).toEqual({
      display: "+39 333 123 4567",
      international: "+393331234567",
    });
    expect(phoneView("0039 333.123.4567", null)?.international).toBe("+393331234567");
    expect(phoneView("+39 (0)2 1234 5678", null)).toEqual({
      display: "+39 02 1234 5678",
      international: "+390212345678",
    });
    // In Italia lo zero del fisso resta; altrove si toglie quello nazionale.
    expect(phoneView("02 1234567", "IT")?.international).toBe("+39021234567");
    expect(phoneView("030 1234567", "DE")).toEqual({
      display: "+49 301234567",
      international: "+49301234567",
    });
    expect(phoneView("+49 000 1000013", null)?.display).toBe("+49 000 1000013");
    // Un valore non riconosciuto non diventa un collegamento.
    for (const [raw, country] of [
      ["interno 14", "IT"],
      ["3331234567", null],
      ["3331234567", "JP"],
      ["+12345", null],
      ["+0123456789", null],
    ] as const)
      expect(phoneView(raw, country)).toBeNull();
    // Email: dominio in minuscolo, alias eBay riconosciuto.
    expect(emailView("  Mario.Rossi@Esempio.INVALID ")).toEqual({
      address: "Mario.Rossi@esempio.invalid",
      relay: false,
    });
    expect(emailView("c3f0a1b2@members.ebay.invalid")).toEqual({
      address: "c3f0a1b2@members.ebay.invalid",
      relay: true,
    });
    expect(emailView("acquisti@notebay.invalid")?.relay).toBe(false);
    for (const raw of ["mario rossi@esempio.invalid", "@esempio.invalid", "mario@", "mario"])
      expect(emailView(raw)).toBeNull();
    // Un `?` o un `&` della fonte restano nell'indirizzo e non aggiungono campi.
    const tricky = emailView("a?subject=Ciao&body=x@esempio.invalid")!;
    expect(mailtoHref(tricky.address)).toBe("mailto:a%3Fsubject%3DCiao%26body%3Dx@esempio.invalid");
    expect(
      mailtoHref("mario.rossi@esempio.invalid", { subject: "CF ordine", body: "Ciao & grazie" }),
    ).toBe("mailto:mario.rossi@esempio.invalid?subject=CF%20ordine&body=Ciao%20%26%20grazie");
    // Indirizzo: maiuscolo e minuscolo uniformi, grafia mista ed estera conservate.
    expect(addressCase("VIA DELL'ORTO 12B")).toBe("Via dell'Orto 12B");
    expect(addressCase("SANT'ANGELO LODIGIANO")).toBe("Sant'Angelo Lodigiano");
    expect(addressCase("VIA XX SETTEMBRE 14, C/O ROSSI SNC")).toBe(
      "Via XX Settembre 14, c/o Rossi SNC",
    );
    expect(addressCase("PIAZZA DI SPAGNA E DEI MILLE")).toBe("Piazza di Spagna e dei Mille");
    // Soltanto numeri romani ben formati restano maiuscoli.
    expect(addressCase("LOCALITÀ IL PRATO 3")).toBe("Località Il Prato 3");
    expect(addressCase("VIA LI MADOU, VIA MILL 2")).toBe("Via Li Madou, Via Mill 2");
    expect(addressCase("VIA PIO IX 4, VIA XXIV MAGGIO")).toBe("Via Pio IX 4, Via XXIV Maggio");
    expect(addressCase("DI FRONTE ALLA STAZIONE")).toBe("Di Fronte alla Stazione");
    expect(addressCase("Via del Corso 1")).toBe("Via del Corso 1");
    expect(addressCase("12345")).toBe("12345");
    expect(addressCase("  via   dell’orto 12B ")).toBe("Via dell’Orto 12B");
    expect(addressCase("via xx settembre 14, c/o rossi snc")).toBe(
      "Via XX Settembre 14, c/o Rossi SNC",
    );
    expect(addressCase("via alla stazione 12a")).toBe("Via alla Stazione 12a");
    expect(addressCase("Via McDonald 12B")).toBe("Via McDonald 12B");
    expect(addressCase("HAUPTSTRASSE 12", "DE")).toBe("HAUPTSTRASSE 12");
    expect(addressCase("ΑΘΗΝΑ", "GR")).toBe("ΑΘΗΝΑ");
    for (const name of [
      "ACME SRL",
      "ACME S.R.L.",
      "ACME SPA",
      "ACME SNC",
      "ACME SAS",
      "ACME SRLS",
      "eBay Italia",
      "McDonald",
      "Maria de la Cruz",
      "M*** R***",
      "M••• R•••",
      "M… R…",
      "ROSSI 123",
    ])
      expect(buyerNameView(`  ${name}  `)).toBe(name);
    for (const [raw, formatted] of [
      ["MARIO ROSSI", "Mario Rossi"],
      ["mario rossi", "Mario Rossi"],
      ["  MARIO\n  DI ROSA  ", "Mario Di Rosa"],
      ["MARIA DELL'ORTO", "Maria Dell'Orto"],
      ["anna d’angelo", "Anna D’Angelo"],
      ["JEAN-PIERRE DUPONT", "Jean-Pierre Dupont"],
      ["JOSÉ ÁLVAREZ", "José Álvarez"],
      ["li wei", "Li Wei"],
      ["LUCA DE LUCA", "Luca De Luca"],
    ])
      expect(buyerNameView(raw!)).toBe(formatted);
    expect(buyerNameView(" Mario\n Rossi ")).toBe("Mario Rossi");
    expect(buyerNameView("  ")).toBeNull();
    expect(buyerNameView(null)).toBeNull();
    for (const raw of ["333..1234567", "333***4567", "1234567", "+44 (0)20 1234 5678"])
      expect(phoneView(raw, "IT")).toBeNull();
    expect(emailView("mario@rossi@example.invalid")).toBeNull();
    expect(emailView("m***@example.invalid")).toBeNull();
    const original = {
      phone: "3331234567",
      email: null,
      shipTo: null,
      billingAddress: {
        line: "  via roma 12B  ",
        postalCode: " 00100 ",
        city: " roma ",
        province: " rm ",
        countryCode: " it ",
      },
    };
    const formatted = contactsView(original);
    expect(addressRows(formatted.billingAddress!, "it")).toEqual([
      "Via Roma 12B",
      "00100 Roma (RM)",
      "Italia",
    ]);
    expect(original.billingAddress.line).toBe("  via roma 12B  ");
    const foreign = contactsView({
      ...original,
      billingAddress: {
        ...original.billingAddress,
        line: "  Calle   Mayor 1 ",
        city: "Madrid",
        province: "Comunidad de Madrid",
        countryCode: "ES",
      },
    });
    expect(foreign.billingAddress?.province).toBe("Comunidad de Madrid");
    expect(
      addressRows(
        {
          ...formatted.billingAddress!,
          line: "",
          city: "",
          province: null,
          countryCode: "",
          postalCode: "00100",
        },
        "en",
      ),
    ).toEqual(["00100"]);
  });

  it("distingue campi mascherati e assenti e copia soltanto i dati fiscali accessibili", () => {
    const masked = view({
      summary: {
        ...base.summary,
        buyer: {
          username: null,
          name: null,
          phone: null,
          email: null,
          billingAddress: null,
          shipTo: null,
          masked: ["name", "phone", "email", "billingAddress.addressLine1", "shipTo.name"],
        },
      },
    });
    expect(masked.maskedContacts).toEqual([
      "name",
      "email",
      "phone",
      "billingAddress",
      "recipient",
    ]);
    expect(missingContact(masked, "email", appCopy.it)).toBe("Mascherato da eBay");
    expect(missingContact(view({}), "email", appCopy.en)).toBe("Not provided by eBay");
    expect(billingCopyText(masked, "it", appCopy.it)).toBe("");
    const onlyEmailMasked = view({
      summary: {
        ...base.summary,
        buyer: {
          ...base.summary.buyer!,
          name: null,
          phone: null,
          email: null,
          shipTo: null,
          masked: ["email"],
        },
      },
    });
    expect(onlyEmailMasked.maskedContacts).toEqual(["email"]);
    const recipientPhoneMasked = view({
      summary: {
        ...base.summary,
        buyer: {
          ...base.summary.buyer!,
          phone: null,
          shipTo: { name: "Mario", phone: null, address: null },
          masked: ["shipTo.phone"],
        },
      },
    });
    expect(recipientPhoneMasked.maskedContacts).toEqual(["phone"]);
    const historical = view({
      summary: {
        ...base.summary,
        buyer: {
          ...base.summary.buyer!,
          name: "Mario Rossi",
          phone: null,
          email: "buyer@example.invalid",
          masked: ["name", "email", "phone", "shipTo.name"],
          shipTo: { name: "Mario", phone: "3331234567", address: null },
        },
      },
    });
    expect(historical.maskedContacts).toEqual([]);
    const order = {
      ...historical,
      buyerName: "  MARIO   ROSSI  ",
      contacts: {
        ...historical.contacts,
        billingAddress: {
          line: "Via Roma 1",
          postalCode: "00100",
          city: "Roma",
          province: "RM",
          countryCode: "IT",
        },
      },
    };
    const prefix = "Mario Rossi\nVia Roma 1\n00100 Roma (RM)\nItalia";
    expect(billingCopyText(order, "it", appCopy.it)).toBe(prefix);
    for (const fiscal of [{ state: "checking" }, { state: "error" }, { state: "missing" }] as const)
      expect(billingCopyText({ ...order, fiscal }, "it", appCopy.it)).toBe(prefix);
    const available = {
      ...order,
      fiscal: {
        state: "available" as const,
        identifiers: [
          { type: "CF" as const, value: "rss mra80a01 h501u", quality: "valid" as const },
          { type: "PIVA" as const, value: " 12345 678901", quality: "unchecked" as const },
          {
            type: "OTHER" as const,
            typeLabel: "NIF",
            value: "123x",
            quality: "unchecked" as const,
          },
        ],
      },
    };
    expect(billingCopyText(available, "it", appCopy.it)).toBe(
      `${prefix}\nCodice Fiscale: RSSMRA80A01H501U\nPartita IVA: 12345678901\nNIF: 123x`,
    );
    expect(billingCopyText(available, "en", appCopy.en)).toContain(
      "Italy\nCodice Fiscale: RSSMRA80A01H501U",
    );
    expect(
      billingCopyText(
        { ...order, buyerName: null, contacts: { ...order.contacts, billingAddress: null } },
        "it",
        appCopy.it,
      ),
    ).toBe("");
  });

  it("legge i criteri dell'indirizzo con i soli valori previsti", () => {
    const at = new Date(now);
    const criteria = (query: string, plan: "free" | "premium" = "free", search?: string) =>
      orderCriteria(new URLSearchParams(query), at, plan, search);
    expect(criteria("")).toEqual({
      storeId: undefined,
      since: undefined,
      payment: undefined,
      shipping: undefined,
      fiscal: undefined,
      tokens: undefined,
    });
    expect(
      criteria("negozio=s-a&periodo=7&pagamento=paid&spedizione=in_progress&fiscale=locked"),
    ).toEqual({
      storeId: "s-a",
      since: new Date(at.getTime() - 7 * 86_400_000).toISOString(),
      payment: "paid",
      shipping: "in_progress",
      fiscal: "locked",
      tokens: undefined,
    });
    expect(criteria("periodo=30").since).toBe(
      new Date(at.getTime() - 30 * 86_400_000).toISOString(),
    );
    // Oltre i 30 giorni i periodi sono Premium; un valore sconosciuto vale come «Tutti».
    for (const period of ["90", "6m", "12m"])
      expect(criteria(`periodo=${period}`).since).toBeUndefined();
    for (const days of [7, 30])
      expect(criteria(`periodo=${days}`, "premium").since).toBe(
        new Date(at.getTime() - days * 86_400_000).toISOString(),
      );
    expect(criteria("periodo=90", "premium").since).toBe(
      new Date(at.getTime() - 90 * 86_400_000).toISOString(),
    );
    // I mesi sono di calendario, come l'anno dello storico Premium.
    expect(criteria("periodo=6m", "premium").since).toBe("2026-03-13T20:00:00.000Z");
    expect(criteria("periodo=12m", "premium").since).toBe("2025-09-13T20:00:00.000Z");
    expect(criteria("periodo=12", "premium").since).toBeUndefined();
    expect(criteria("periodo=1&pagamento=delivered&spedizione=x&fiscale=x")).toMatchObject({
      since: undefined,
      payment: undefined,
      shipping: undefined,
      fiscal: undefined,
    });
    // Ricerca già decifrata, divisa sugli spazi nella forma di confronto, al massimo dieci
    // parole; una query nell'indirizzo non conta.
    expect(criteria("", "free", " Giulia\t SKU-A  ").tokens).toEqual(["giulia", "sku-a"]);
    expect(criteria("", "free", "ÖZTÜRK Lucía").tokens).toEqual(["ozturk", "lucia"]);
    expect(criteria("q=giulia").tokens).toBeUndefined();
    expect(criteria("", "free", "   ").tokens).toBeUndefined();
    expect(
      criteria("", "free", Array.from({ length: 12 }, (_, i) => `p${i}`).join(" ")).tokens,
    ).toHaveLength(10);
    expect(criteria("fiscale=foreign").fiscal).toBe("foreign");
    // Identificativi oltre 64 caratteri non filtrano.
    expect(criteria(`negozio=${"x".repeat(64)}`).storeId).toBe("x".repeat(64));
    expect(criteria(`negozio=${"x".repeat(65)}`).storeId).toBeUndefined();
    expect(criteria("marketplace=EBAY_IT")).not.toHaveProperty("marketplace");
  });
});
