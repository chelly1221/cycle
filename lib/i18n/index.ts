export type Locale = 'ko'
export const locales: Locale[] = ['ko']
export const defaultLocale: Locale = 'ko'

export async function getDictionary(_locale?: Locale) {
  return (await import('./ko')).default
}
