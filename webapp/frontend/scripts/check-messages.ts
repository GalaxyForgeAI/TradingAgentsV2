import en from "../i18n/messages/en.json";
import zh from "../i18n/messages/zh.json";

function flatten(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const enKeys = new Set(flatten(en));
const zhKeys = new Set(flatten(zh));
const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k));
const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k));

if (missingInZh.length || missingInEn.length) {
  if (missingInZh.length) console.error("Missing in zh.json:", missingInZh);
  if (missingInEn.length) console.error("Missing in en.json:", missingInEn);
  process.exit(1);
}
console.log(`Message key parity OK — ${enKeys.size} keys.`);
