insert into public.print_methods (slug, name, description, status)
values
  ('dtf', 'چاپ DTF', 'چاپ مستقیم فیلم مناسب پوشاک و پارچه', 'ACTIVE'),
  ('dtg', 'چاپ مستقیم روی پارچه (DTG)', 'چاپ مستقیم طرح روی پوشاک', 'ACTIVE'),
  ('sublimation', 'چاپ سابلیمیشن', 'چاپ حرارتی مناسب پارچه و محصولات مخصوص سابلیمیشن', 'ACTIVE'),
  ('screen-printing', 'چاپ سیلک', 'چاپ سیلک برای تیراژهای مختلف', 'ACTIVE'),
  ('embroidery', 'گلدوزی', 'اجرای طرح به روش گلدوزی', 'ACTIVE'),
  ('uv', 'چاپ UV', 'چاپ مستقیم UV روی سطوح سازگار', 'ACTIVE')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  updated_at = now();
