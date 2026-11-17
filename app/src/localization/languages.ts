export const SUPPORTED_LANGUAGES = ['en', 'te'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
