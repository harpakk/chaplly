create or replace function public.service_catalog_products()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with selected_products as (
    select p.*
    from public.seller_products p
    where p.status='PUBLISHED' and p.moderation_status='APPROVED'
    order by p.published_at desc,p.id
    limit 240
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',p.id,
      'store_id',p.store_id,
      'raw_product_id',p.raw_product_id,
      'slug',p.slug,
      'title',p.title,
      'subtitle',p.subtitle,
      'description',p.description,
      'price',p.price,
      'discounted_price',p.discounted_price,
      'rating_average',p.rating_average,
      'review_count',p.review_count,
      'sales_count',p.sales_count,
      'view_count',p.view_count,
      'is_featured',p.is_featured,
      'published_at',p.published_at,
      'store',(
        select jsonb_build_object(
          'id',s.id,'name',s.name,'slug',s.slug,
          'follower_count',s.follower_count,'description',s.description,
          'social_url',s.social_url
        )
        from public.stores s
        where s.id=p.store_id and s.status='ACTIVE'
      ),
      'rawProduct',(
        select jsonb_build_object(
          'id',r.id,'name',r.name,
          'subcategory',jsonb_build_object(
            'id',subcategory.id,'slug',subcategory.slug,
            'name',subcategory.name,'description',subcategory.description
          ),
          'category',jsonb_build_object(
            'id',coalesce(category.id,subcategory.id),
            'slug',coalesce(category.slug,subcategory.slug),
            'name',coalesce(category.name,subcategory.name),
            'description',coalesce(category.description,subcategory.description)
          )
        )
        from public.raw_products r
        left join public.categories subcategory on subcategory.id=r.category_id
        left join public.categories category on category.id=subcategory.parent_id
        where r.id=p.raw_product_id
      ),
      'images',coalesce((
        select jsonb_agg(jsonb_build_object(
          'alt_text',image.alt_text,'is_primary',image.is_primary,
          'sort_order',image.sort_order,
          'file',jsonb_build_object('bucket',file.bucket,'path',file.path,'state',file.state)
        ) order by image.is_primary desc,image.sort_order)
        from public.product_images image
        join public.storage_files file on file.id=image.file_id
        where image.seller_product_id=p.id
      ),'[]'::jsonb),
      'details',coalesce((
        select jsonb_agg(jsonb_build_object(
          'title',detail.title,'value',detail.value,'sort_order',detail.sort_order
        ) order by detail.sort_order)
        from public.product_details detail
        where detail.seller_product_id=p.id
      ),'[]'::jsonb),
      'tags',coalesce((
        select jsonb_agg(jsonb_build_object('slug',tag.slug,'name',tag.name))
        from public.product_tags product_tag
        join public.tags tag on tag.id=product_tag.tag_id
        where product_tag.seller_product_id=p.id
      ),'[]'::jsonb),
      'styles',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',style.id,'slug',style.slug,'name',style.name,'caption',style.caption
        ) order by style.sort_order,style.name)
        from public.product_graphic_styles product_style
        join public.graphic_styles style on style.id=product_style.graphic_style_id
        where product_style.seller_product_id=p.id
      ),'[]'::jsonb),
      'videos',coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket',file.bucket,'path',file.path,'state',file.state
        ) order by video.sort_order)
        from public.product_videos video
        join public.storage_files file on file.id=video.file_id
        where video.seller_product_id=p.id
      ),'[]'::jsonb),
      'variants',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',variant.id,'price',variant.price,
          'compare_at_price',variant.compare_at_price,'status',variant.status,
          'color',jsonb_build_object('name',color.name,'hex',color.hex),
          'size',jsonb_build_object('name',size.name),
          'stock',jsonb_build_object(
            'stock_quantity',stock.stock_quantity,'stock_status',stock.stock_status
          )
        ))
        from public.seller_product_variants variant
        join public.raw_product_variants raw_variant on raw_variant.id=variant.raw_product_variant_id
        join public.raw_product_colors color on color.id=raw_variant.color_id
        join public.raw_product_sizes size on size.id=raw_variant.size_id
        left join public.supplier_offer_variants stock on stock.id=variant.supplier_offer_variant_id
        where variant.seller_product_id=p.id and variant.status='ACTIVE'
      ),'[]'::jsonb)
    ) order by p.published_at desc,p.id
  ),'[]'::jsonb)
  from selected_products p
$$;

create or replace function public.service_marketplace_context()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'banners',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',banner.id,'eyebrow',banner.eyebrow,'title',banner.title,
        'body',banner.body,'cta_label',banner.cta_label,'cta_url',banner.cta_url,
        'tone',banner.tone,
        'file',jsonb_build_object('bucket',file.bucket,'path',file.path)
      ) order by banner.sort_order)
      from (
        select * from public.homepage_banners
        where status='ACTIVE' order by sort_order limit 12
      ) banner
      left join public.storage_files file on file.id=banner.desktop_file_id
    ),'[]'::jsonb),
    'stores',coalesce((
      select jsonb_agg(to_jsonb(store) order by store.follower_count desc)
      from (
        select id,name,slug,description,social_url,follower_count,logo_file_id,banner_file_id
        from public.stores where status='ACTIVE'
        order by follower_count desc limit 24
      ) store
    ),'[]'::jsonb),
    'styles',coalesce((
      select jsonb_agg(to_jsonb(style) order by style.sort_order)
      from (
        select id,slug,name,caption,sort_order
        from public.graphic_styles where status='ACTIVE'
        order by sort_order limit 24
      ) style
    ),'[]'::jsonb),
    'categories',coalesce((
      select jsonb_agg(to_jsonb(category) order by category.sort_order)
      from (
        select id,parent_id,slug,name,description,sort_order
        from public.categories where status='ACTIVE' and parent_id is null
        order by sort_order limit 24
      ) category
    ),'[]'::jsonb),
    'reels',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',reel.id,'store_id',reel.store_id,
        'seller_product_id',reel.seller_product_id,'caption',reel.caption,
        'like_count',reel.like_count,'save_count',reel.save_count,
        'published_at',reel.published_at,
        'store',jsonb_build_object('name',store.name,'slug',store.slug,'social_url',store.social_url),
        'product',jsonb_build_object('slug',product.slug),
        'file',jsonb_build_object('bucket',file.bucket,'path',file.path)
      ) order by reel.published_at desc)
      from (
        select * from public.reel_posts
        where status='PUBLISHED' order by published_at desc limit 30
      ) reel
      left join public.stores store on store.id=reel.store_id
      left join public.seller_products product on product.id=reel.seller_product_id
      left join public.storage_files file on file.id=reel.video_file_id
    ),'[]'::jsonb)
  )
$$;

revoke all on function public.service_catalog_products() from public;
revoke all on function public.service_marketplace_context() from public;
grant execute on function public.service_catalog_products() to anon,authenticated,service_role;
grant execute on function public.service_marketplace_context() to anon,authenticated,service_role;
