alter table public.stores
  add column if not exists storefront_config jsonb not null default jsonb_build_object(
    'heroEnabled', true,
    'tagline', '',
    'announcementEnabled', false,
    'announcement', '',
    'bannerEnabled', false,
    'bannerMode', 'STATIC',
    'banners', '[]'::jsonb,
    'aboutEnabled', false,
    'aboutTitle', 'درباره ما',
    'aboutBody', '',
    'faqEnabled', false,
    'faqs', '[]'::jsonb,
    'popularEnabled', true,
    'newestEnabled', true,
    'discountsEnabled', true,
    'affordableEnabled', true,
    'reelsEnabled', true
  );

comment on column public.stores.storefront_config is
  'Seller-managed landing-page content and section visibility for the public storefront.';
