import cloudflare from "./vitest.cloudflare.config";
import unit from "./vitest.unit.config";

const base = ["app/auth-route.server.ts", "app/integrations/ebay/fulfillment.server.ts"].includes(
  process.env.MUTATION_TARGET ?? "",
)
  ? unit
  : cloudflare;
const files: unknown = JSON.parse(process.env.MUTATION_TEST_FILES ?? "null");
if (
  !Array.isArray(files) ||
  files.length === 0 ||
  files.some(
    (file) => typeof file !== "string" || !/^test\/[\w./-]+\.(?:unit|spec)\.ts$/u.test(file),
  )
)
  throw new Error("Selezione dei test mutation assente o non valida.");

export default { ...base, test: { ...base.test, include: files } };
