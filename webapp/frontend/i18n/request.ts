import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, negotiate, type Locale } from "./locales";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("NEXT_LOCALE")?.value;
  let locale: Locale = DEFAULT_LOCALE;
  if (isLocale(fromCookie)) {
    locale = fromCookie;
  } else {
    const accept = (await headers()).get("accept-language");
    locale = negotiate(accept);
  }
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
