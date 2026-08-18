-- Preserve seller-entered consumer prices when their derived percentage is a
-- repeating decimal. Eight decimal places keep the derived price at or above
-- the submitted amount while percentage remains the authoritative value.
drop trigger if exists seller_variant_derive_price on public.seller_product_variants;
drop trigger if exists seller_product_property_markups_touch on public.seller_product_property_markups;
alter table public.seller_product_variants
  alter column markup_percentage type numeric(12,8);
alter table public.seller_product_property_markups
  alter column markup_percentage type numeric(12,8);
create trigger seller_variant_derive_price before insert or update of markup_percentage,supplier_offer_variant_id,price
on public.seller_product_variants for each row execute function public.derive_seller_variant_price();
create trigger seller_product_property_markups_touch before update on public.seller_product_property_markups
for each row execute function public.touch_updated_at();
