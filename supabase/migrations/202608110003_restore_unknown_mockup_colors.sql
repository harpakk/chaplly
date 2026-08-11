-- The previous repair guessed the first active color for every legacy mockup.
-- Those rows all received the migration timestamp through the touch trigger.
-- Restore them to unknown so the admin can make an accurate selection; newly
-- created or edited mockups keep their explicitly saved color.
update public.raw_product_mockups
set color_id=null
where updated_at=(
  select applied_at from public._chapli_migrations
  where name='202608110002_store_media_and_mockup_colors.sql'
);
