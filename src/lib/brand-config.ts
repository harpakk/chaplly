export const brandConfig = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "چاپلی",
  logos: {
    orange:
      process.env.NEXT_PUBLIC_BRAND_LOGO_ORANGE?.trim() ||
      "/brand/chapli-orange.png",
    white:
      process.env.NEXT_PUBLIC_BRAND_LOGO_WHITE?.trim() ||
      "/brand/chapli-white.png",
  },
} as const;
