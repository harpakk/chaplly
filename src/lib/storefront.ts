export type StorefrontBanner = {
  url: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type StorefrontFaq = { question: string; answer: string };

export type StorefrontConfig = {
  heroEnabled: boolean;
  tagline: string;
  announcementEnabled: boolean;
  announcement: string;
  bannerEnabled: boolean;
  bannerMode: "STATIC" | "SLIDER";
  banners: StorefrontBanner[];
  aboutEnabled: boolean;
  aboutTitle: string;
  aboutBody: string;
  faqEnabled: boolean;
  faqs: StorefrontFaq[];
  popularEnabled: boolean;
  newestEnabled: boolean;
  discountsEnabled: boolean;
  affordableEnabled: boolean;
  reelsEnabled: boolean;
};

export const defaultStorefrontConfig: StorefrontConfig = {
  heroEnabled: true,
  tagline: "",
  announcementEnabled: false,
  announcement: "",
  bannerEnabled: false,
  bannerMode: "STATIC",
  banners: [],
  aboutEnabled: false,
  aboutTitle: "درباره ما",
  aboutBody: "",
  faqEnabled: false,
  faqs: [],
  popularEnabled: true,
  newestEnabled: true,
  discountsEnabled: true,
  affordableEnabled: true,
  reelsEnabled: true,
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const flag = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export function normalizeStorefrontConfig(value: unknown): StorefrontConfig {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const banners = Array.isArray(row.banners)
    ? row.banners.slice(0, 3).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const banner = item as Record<string, unknown>;
        const url = text(banner.url);
        return url
          ? [{
              url,
              title: text(banner.title),
              subtitle: text(banner.subtitle),
              ctaLabel: text(banner.ctaLabel),
              ctaUrl: text(banner.ctaUrl),
            }]
          : [];
      })
    : [];
  const faqs = Array.isArray(row.faqs)
    ? row.faqs.slice(0, 8).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const faq = item as Record<string, unknown>;
        const question = text(faq.question).trim();
        const answer = text(faq.answer).trim();
        return question && answer ? [{ question, answer }] : [];
      })
    : [];
  return {
    heroEnabled: flag(row.heroEnabled, true),
    tagline: text(row.tagline),
    announcementEnabled: flag(row.announcementEnabled, false),
    announcement: text(row.announcement),
    bannerEnabled: flag(row.bannerEnabled, false),
    bannerMode: row.bannerMode === "SLIDER" ? "SLIDER" : "STATIC",
    banners,
    aboutEnabled: flag(row.aboutEnabled, false),
    aboutTitle: text(row.aboutTitle) || "درباره ما",
    aboutBody: text(row.aboutBody),
    faqEnabled: flag(row.faqEnabled, false),
    faqs,
    popularEnabled: flag(row.popularEnabled, true),
    newestEnabled: flag(row.newestEnabled, true),
    discountsEnabled: flag(row.discountsEnabled, true),
    affordableEnabled: flag(row.affordableEnabled, true),
    reelsEnabled: flag(row.reelsEnabled, true),
  };
}
