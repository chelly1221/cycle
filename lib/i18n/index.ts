export type Locale = 'en' | 'ko'
export const locales: Locale[] = ['en', 'ko']
export const defaultLocale: Locale = 'en'

export async function getDictionary(locale: Locale) {
  return locale === 'ko'
    ? (await import('./ko')).default
    : (await import('./en')).default
}
