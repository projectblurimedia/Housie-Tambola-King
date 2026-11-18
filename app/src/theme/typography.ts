export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  /** Big numbers & headings. Poppins everywhere (owner preference). */
  display: 'Poppins_800ExtraBold',
  /** The "Housie Tambola King" wordmark. */
  brand: 'Lobster_400Regular',
} as const;

export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32 },
  h2: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 26 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallBold: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
} as const;
