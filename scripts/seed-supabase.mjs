import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {connectPostgres} from "./postgres-client.mjs";

const required=["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SECRET_KEY","DATABASE_URL"];
for(const key of required) if(!process.env[key]) throw new Error(`${key} is required`);
if(process.env.NODE_ENV==="production"&&process.env.ALLOW_PRODUCTION_SEED!=="true"){
  throw new Error("Production seeding is disabled. Set ALLOW_PRODUCTION_SEED=true only for an explicitly approved demo environment.");
}

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},
});
const password=process.env.SEED_DEFAULT_PASSWORD||"ChapliDemo!1405";
const accounts=[
  {key:"admin",email:"admin@chapli.dev",first:"مدیر",last:"چاپلی",role:"ADMIN"},
  {key:"buyer1",email:"buyer@chapli.dev",first:"سارا",last:"احمدی",role:"BUYER"},
  {key:"buyer2",email:"buyer2@chapli.dev",first:"آرین",last:"محمدی",role:"BUYER"},
  {key:"seller1",email:"seller@chapli.dev",first:"نیلوفر",last:"راد",role:"SELLER"},
  {key:"seller2",email:"seller2@chapli.dev",first:"پارسا",last:"کریمی",role:"SELLER"},
  {key:"seller3",email:"seller3@chapli.dev",first:"ترانه",last:"صادقی",role:"SELLER"},
  {key:"supplier1",email:"supplier@chapli.dev",first:"رضا",last:"اطلسی",role:"SUPPLIER"},
  {key:"supplier2",email:"supplier2@chapli.dev",first:"ماهور",last:"رنگین",role:"SUPPLIER"},
];

const listed=[];
for(let page=1;;page++){
  const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});
  if(error) throw error;
  listed.push(...data.users);
  if(data.users.length<1000) break;
}
const authIds={};
for(const account of accounts){
  let user=listed.find(item=>item.email?.toLowerCase()===account.email);
  if(!user){
    const {data,error}=await supabase.auth.admin.createUser({
      email:account.email,password,email_confirm:true,
      user_metadata:{first_name:account.first,last_name:account.last,role:account.role,seed:true},
    });
    if(error) throw error;
    user=data.user;
  }else if(process.env.SEED_RESET_PASSWORDS==="true"){
    const {data,error}=await supabase.auth.admin.updateUserById(user.id,{
      password,email_confirm:true,
      user_metadata:{...user.user_metadata,first_name:account.first,last_name:account.last,role:account.role,seed:true},
    });
    if(error) throw error;
    user=data.user;
  }
  authIds[account.key]=user.id;
}

const db=await connectPostgres();
const q=(text,values=[])=>db.query(text,values);
const quote=(value)=>`"${String(value).replaceAll('"','""')}"`;
async function upsert(table,data,conflict=["id"]){
  const columns=Object.keys(data);
  const values=Object.values(data);
  const conflictColumns=Array.isArray(conflict)?conflict:[conflict];
  const updateColumns=columns.filter(column=>!conflictColumns.includes(column));
  const sql=`insert into public.${quote(table)}(${columns.map(quote).join(",")})
    values(${columns.map((_,index)=>`$${index+1}`).join(",")})
    on conflict(${conflictColumns.map(quote).join(",")}) do ${updateColumns.length
      ?`update set ${updateColumns.map(column=>`${quote(column)}=excluded.${quote(column)}`).join(",")}`
      :"nothing"} returning *`;
  return (await q(sql,values)).rows[0];
}
async function insertIgnore(table,data,conflict=["id"]){
  const columns=Object.keys(data);
  const values=Object.values(data);
  const conflictColumns=Array.isArray(conflict)?conflict:[conflict];
  const sql=`insert into public.${quote(table)}(${columns.map(quote).join(",")})
    values(${columns.map((_,index)=>`$${index+1}`).join(",")})
    on conflict(${conflictColumns.map(quote).join(",")}) do nothing`;
  await q(sql,values);
}
const sid=(n)=>`00000000-0000-4000-8000-${Number(n).toString(16).padStart(12,"0")}`;
const now=new Date();
const days=(offset)=>new Date(now.getTime()+offset*86400000).toISOString();

await q("begin");
try{
  // Auth-linked profiles -------------------------------------------------------
  for(const account of accounts){
    await q(`update public.profiles set primary_role=$2,email=$3,first_name=$4,last_name=$5,state='ACTIVE',updated_at=now() where id=$1`,[
      authIds[account.key],account.role,account.email,account.first,account.last,
    ]);
    await upsert("ai_credit_accounts",{user_id:authIds[account.key],lifetime_granted:1,lifetime_used:account.key==="seller2"?1:0},["user_id"]);
  }
  await upsert("admin_profiles",{user_id:authIds.admin,role:"SUPER_ADMIN",is_active:true},["user_id"]);
  await upsert("buyer_profiles",{user_id:authIds.buyer1,display_name:"سارا",marketing_consent:true,marketing_consent_at:days(-120)},["user_id"]);
  await upsert("buyer_profiles",{user_id:authIds.buyer2,display_name:"آرین",marketing_consent:false,marketing_consent_at:null},["user_id"]);

  // Organizations and memberships --------------------------------------------
  const organizations=[
    {id:sid(1),type:"PLATFORM",legal_name:"چاپلی",display_name:"چاپلی",slug:"chapli-platform",status:"ACTIVE",contact_email:"admin@chapli.dev",description:"تیم عملیات چاپلی"},
    {id:sid(2),type:"SELLER",legal_name:"استودیو نوا",display_name:"استودیو نوا",slug:"seller-studio-nava",status:"ACTIVE",contact_email:"seller@chapli.dev",contact_phone:"09120000001",description:"مینیمال‌های رنگی برای روزهای معمولیِ غیرمعمولی"},
    {id:sid(3),type:"SELLER",legal_name:"خانه رنگی",display_name:"خانه رنگی",slug:"seller-khane-rangi",status:"ACTIVE",contact_email:"seller2@chapli.dev",contact_phone:"09120000002",description:"اشیای روزمره با کمی شوخی و رنگ بیشتر"},
    {id:sid(4),type:"SELLER",legal_name:"ابر کوچک",display_name:"ابر کوچک",slug:"seller-abre-koochak",status:"ACTIVE",contact_email:"seller3@chapli.dev",contact_phone:"09120000003",description:"تصویرسازی‌های نرم برای آدم‌های خیال‌باف"},
    {id:sid(5),type:"SUPPLIER",legal_name:"چاپ اطلس ایرانیان",display_name:"چاپ اطلس",slug:"supplier-atlas",status:"ACTIVE",contact_email:"supplier@chapli.dev",contact_phone:"02188770001",description:"چاپ پوشاک و اکسسوری با کنترل کیفیت دو مرحله‌ای",national_id:"14001234567",registration_number:"553210"},
    {id:sid(6),type:"SUPPLIER",legal_name:"ماهور نقش رنگین",display_name:"ماهور پرینت",slug:"supplier-mahur",status:"ACTIVE",contact_email:"supplier2@chapli.dev",contact_phone:"02537770002",description:"تولید سریع محصولات چاپی و دکور",national_id:"14007654321",registration_number:"884210"},
  ];
  for(const organization of organizations) await upsert("organizations",organization);
  const memberships=[
    [authIds.admin,sid(1),"OWNER"],[authIds.seller1,sid(2),"OWNER"],
    [authIds.seller2,sid(3),"OWNER"],[authIds.seller3,sid(4),"OWNER"],
    [authIds.supplier1,sid(5),"OWNER"],[authIds.supplier2,sid(6),"OWNER"],
  ];
  for(let index=0;index<memberships.length;index++){
    const [user_id,organization_id,role]=memberships[index];
    await upsert("memberships",{id:sid(20+index),user_id,organization_id,role,status:"ACTIVE"},["user_id","organization_id"]);
  }
  await upsert("seller_profiles",{organization_id:sid(2),owner_user_id:authIds.seller1,seller_type:"CREATOR",experience_level:"PRO",instagram_handle:"@nava",audience_size:12800,monthly_views:1100000,goal:"ساخت برند مستقل",status:"ACTIVE"},["organization_id"]);
  await upsert("seller_profiles",{organization_id:sid(3),owner_user_id:authIds.seller2,seller_type:"INFLUENCER",experience_level:"GROWING",instagram_handle:"@khane.rangi",audience_size:9400,monthly_views:760000,goal:"درآمد از مخاطب",status:"ACTIVE"},["organization_id"]);
  await upsert("seller_profiles",{organization_id:sid(4),owner_user_id:authIds.seller3,seller_type:"GRAPHIC_DESIGNER",experience_level:"NEW",instagram_handle:"@abre.koochak",audience_size:7300,monthly_views:410000,goal:"فروش تصویرسازی",status:"ACTIVE"},["organization_id"]);
  await upsert("supplier_profiles",{organization_id:sid(5),owner_user_id:authIds.supplier1,national_id:"14001234567",registration_number:"553210",capacity_per_day:180,lead_time_days:2,approval_mode:"AUTO",status:"APPROVED",description:"DTF و سابلیمیشن با QC کامل"},["organization_id"]);
  await upsert("supplier_profiles",{organization_id:sid(6),owner_user_id:authIds.supplier2,national_id:"14007654321",registration_number:"884210",capacity_per_day:120,lead_time_days:3,approval_mode:"AUTO",status:"APPROVED",description:"چاپ پوشاک، پوستر و بسته‌بندی"},["organization_id"]);
  await upsert("facilities",{id:sid(30),organization_id:sid(5),name:"مرکز تهران اطلس",city:"تهران",address:"خیابان مطهری، پلاک ۲۱",postal_code:"1587611111",phone:"02188770001",working_days:[0,1,2,3,4,5],cutoff_time:"15:00",status:"ACTIVE"});
  await upsert("facilities",{id:sid(31),organization_id:sid(6),name:"مرکز قم ماهور",city:"قم",address:"شهرک صنعتی، فاز ۲",postal_code:"3718811111",phone:"02537770002",working_days:[0,1,2,3,4],cutoff_time:"14:00",status:"ACTIVE"});

  // Categories ---------------------------------------------------------------
  async function category(slug,name,parent_id=null,sort_order=0,description=null){
    const result=await q(`insert into public.categories(slug,name,parent_id,sort_order,description,status)
      values($1,$2,$3,$4,$5,'ACTIVE') on conflict(slug) do update set
      name=excluded.name,parent_id=excluded.parent_id,sort_order=excluded.sort_order,
      description=excluded.description,status='ACTIVE' returning id`,[slug,name,parent_id,sort_order,description]);
    return result.rows[0].id;
  }
  const categoryIds={};
  categoryIds.apparel=await category("apparel","پوشاک",null,10,"تیشرت، دورس و هودی با طرح‌های مستقل");
  categoryIds.home=await category("home-living","خانه و زندگی",null,20,"ماگ و محصولات دکور روزمره");
  categoryIds.accessories=await category("accessories","اکسسوری",null,30,"کیف و همراه‌های روزمره");
  categoryIds.art=await category("art-decor","هنر و دکور",null,40,"پوستر و چاپ هنری");
  categoryIds.stationery=await category("stationery","لوازم تحریر",null,50,"دفتر و نوشت‌افزار خاص");
  categoryIds.tshirts=await category("tshirts","تیشرت",categoryIds.apparel,11);
  categoryIds.hoodies=await category("hoodies","هودی و دورس",categoryIds.apparel,12);
  categoryIds.mugs=await category("mugs","ماگ",categoryIds.home,21);
  categoryIds.totes=await category("tote-bags","توت‌بگ",categoryIds.accessories,31);
  categoryIds.posters=await category("posters","پوستر",categoryIds.art,41);
  categoryIds.notebooks=await category("notebooks","دفتر",categoryIds.stationery,51);

  const printMethods=[
    {id:sid(40),slug:"dtf",name:"چاپ DTF",description:"مناسب پوشاک پنبه‌ای و ترکیبی",status:"ACTIVE"},
    {id:sid(41),slug:"sublimation",name:"سابلیمیشن",description:"مناسب ماگ و سطوح پوشش‌دار",status:"ACTIVE"},
    {id:sid(42),slug:"fine-art",name:"چاپ هنری",description:"چاپ دقیق روی کاغذ و بوم",status:"ACTIVE"},
  ];
  for(const item of printMethods) await upsert("print_methods",item,["slug"]);
  for(const method of [sid(40),sid(41)]) await upsert("supplier_print_methods",{supplier_organization_id:sid(5),print_method_id:method},["supplier_organization_id","print_method_id"]);
  for(const method of [sid(40),sid(42)]) await upsert("supplier_print_methods",{supplier_organization_id:sid(6),print_method_id:method},["supplier_organization_id","print_method_id"]);
  for(const cat of [categoryIds.tshirts,categoryIds.hoodies,categoryIds.mugs,categoryIds.totes]) await upsert("supplier_category_capabilities",{supplier_organization_id:sid(5),category_id:cat},["supplier_organization_id","category_id"]);
  for(const cat of [categoryIds.tshirts,categoryIds.hoodies,categoryIds.posters]) await upsert("supplier_category_capabilities",{supplier_organization_id:sid(6),category_id:cat},["supplier_organization_id","category_id"]);

  // Storage metadata is inserted after the owning organizations exist.
  const files={
    product:{id:sid(100),bucket:"product-images",path:"demo/product-placeholder.png",kind:"PRODUCT_IMAGE",owner_organization_id:sid(1)},
    logo:{id:sid(101),bucket:"product-images",path:"demo/store-logo.png",kind:"STORE_LOGO",owner_organization_id:sid(1)},
    banner:{id:sid(102),bucket:"product-images",path:"demo/store-banner.png",kind:"STORE_BANNER",owner_organization_id:sid(1)},
    rawImage:{id:sid(103),bucket:"raw-product-assets",path:"demo/raw-product.png",kind:"RAW_PRODUCT_IMAGE",owner_organization_id:sid(1)},
    background:{id:sid(104),bucket:"raw-product-assets",path:"demo/background.png",kind:"RAW_BACKGROUND",owner_organization_id:sid(1)},
    overlay:{id:sid(105),bucket:"raw-product-assets",path:"demo/overlay.png",kind:"RAW_OVERLAY",owner_organization_id:sid(1)},
    mockup:{id:sid(106),bucket:"variant-mockups",path:"demo/mockup.png",kind:"VARIANT_MOCKUP",owner_organization_id:sid(1)},
    design:{id:sid(107),bucket:"design-files",path:`${authIds.seller1}/demo/design.png`,kind:"DESIGN_SOURCE",owner_user_id:authIds.seller1,owner_organization_id:sid(2)},
    printable:{id:sid(108),bucket:"printable-exports",path:`${authIds.seller1}/demo/printable.png`,kind:"PRINTABLE_EXPORT",owner_user_id:authIds.seller1,owner_organization_id:sid(2)},
    ai:{id:sid(109),bucket:"ai-generated",path:`${authIds.seller2}/demo/ai.png`,kind:"AI_IMAGE",owner_user_id:authIds.seller2,owner_organization_id:sid(3)},
    receipt:{id:sid(110),bucket:"payout-receipts",path:`${authIds.admin}/demo/receipt.png`,kind:"PAYOUT_RECEIPT",owner_user_id:authIds.admin,owner_organization_id:sid(1)},
    ticket:{id:sid(111),bucket:"ticket-attachments",path:`${authIds.seller1}/demo/ticket.png`,kind:"TICKET_ATTACHMENT",owner_user_id:authIds.seller1,owner_organization_id:sid(2)},
  };
  for(const file of Object.values(files)){
    await upsert("storage_files",{
      id:file.id,owner_user_id:file.owner_user_id??null,
      owner_organization_id:file.owner_organization_id??null,bucket:file.bucket,path:file.path,
      kind:file.kind,original_name:"product-placeholder.png",mime_type:"image/png",
      size_bytes:1869459,checksum_sha256:null,width:1200,height:1200,state:"READY",
      metadata:JSON.stringify({seed:true,placeholder:true}),
    });
  }

  // Stores -------------------------------------------------------------------
  const stores=[
    {id:sid(50),organization_id:sid(2),owner_user_id:authIds.seller1,name:"استودیو نوا",slug:"studio-nava",status:"ACTIVE",description:"مینیمال‌های رنگی برای روزهای معمولیِ غیرمعمولی",primary_category:"apparel",support_email:"seller@chapli.dev",support_phone:"09120000001",social_url:"https://instagram.com/nava",logo_file_id:files.logo.id,banner_file_id:files.banner.id,brand_color:"#ef5b4c",accent_color:"#3d8b70",brand_tone:"PLAYFUL",follower_count:12800,is_verified:true},
    {id:sid(51),organization_id:sid(3),owner_user_id:authIds.seller2,name:"خانه رنگی",slug:"khane-rangi",status:"ACTIVE",description:"اشیای روزمره با کمی شوخی و رنگ بیشتر",primary_category:"home-living",support_email:"seller2@chapli.dev",support_phone:"09120000002",social_url:"https://instagram.com/khane.rangi",logo_file_id:files.logo.id,banner_file_id:files.banner.id,brand_color:"#ffc8d5",accent_color:"#4b6fff",brand_tone:"FUN",follower_count:9400,is_verified:true},
    {id:sid(52),organization_id:sid(4),owner_user_id:authIds.seller3,name:"ابر کوچک",slug:"abre-koochak",status:"ACTIVE",description:"تصویرسازی‌های نرم برای آدم‌های خیال‌باف",primary_category:"accessories",support_email:"seller3@chapli.dev",support_phone:"09120000003",social_url:"https://instagram.com/abre.koochak",logo_file_id:files.logo.id,banner_file_id:files.banner.id,brand_color:"#cab9ff",accent_color:"#719b82",brand_tone:"SOFT",follower_count:7300,is_verified:true},
  ];
  for(const store of stores) await upsert("stores",store);

  // Raw products, dimensions, variants, and printable sides ------------------
  const raws=[
    {id:sid(200),category_id:categoryIds.tshirts,slug:"oversized-cotton-tshirt",sku_prefix:"TEE-OVR",name:"تیشرت اورسایز پنبه‌ای",description:"پنبه سنگین، مناسب چاپ جلو و پشت",base_cost:8060000,suggested_price:12900000,has_back:true,material:"پنبه ۲۴۰ گرم",weight_grams:320,status:"ACTIVE"},
    {id:sid(201),category_id:categoryIds.hoodies,slug:"three-thread-hoodie",sku_prefix:"HD-3T",name:"هودی دورس سه‌نخ",description:"هودی گرم با سطح چاپ پایدار",base_cost:18400000,suggested_price:24900000,has_back:true,material:"دورس سه‌نخ",weight_grams:680,status:"ACTIVE"},
    {id:sid(202),category_id:categoryIds.mugs,slug:"ceramic-mug-330",sku_prefix:"MUG-330",name:"ماگ سرامیکی ۳۳۰ میلی‌لیتر",description:"ماگ سفید مناسب چاپ سابلیمیشن",base_cost:3900000,suggested_price:6900000,has_back:false,material:"سرامیک لعاب‌دار",weight_grams:360,status:"ACTIVE"},
    {id:sid(203),category_id:categoryIds.totes,slug:"canvas-tote",sku_prefix:"TOTE-CNV",name:"توت‌بگ کتان",description:"کتان ضخیم با چاپ یک یا دو رو",base_cost:5400000,suggested_price:8900000,has_back:true,material:"کتان ۱۲ انس",weight_grams:220,status:"ACTIVE"},
    {id:sid(204),category_id:categoryIds.posters,slug:"fine-art-poster",sku_prefix:"PST-ART",name:"پوستر هنری مات",description:"کاغذ مات ۲۵۰ گرم با چاپ دقیق",base_cost:2400000,suggested_price:4900000,has_back:false,material:"کاغذ مات",weight_grams:80,status:"ACTIVE"},
  ];
  for(const raw of raws) await upsert("raw_products",raw,["slug"]);
  await q(`update public.raw_products set status='INACTIVE' where id<>all($1::uuid[]) and slug like 'raw-%'`,[raws.map(item=>item.id)]);

  const colorSpecs=[
    [sid(210),sid(200),"black","مشکی","#202124",0],[sid(211),sid(200),"white","سفید","#f8f7f3",1],[sid(212),sid(200),"lilac","یاسی","#bcb0e7",2],
    [sid(213),sid(201),"black","مشکی","#202124",0],[sid(214),sid(201),"cream","کرم","#e7dcc8",1],
    [sid(215),sid(202),"white","سفید","#f8f7f3",0],[sid(216),sid(202),"cream","کرم","#e7dcc8",1],
    [sid(217),sid(203),"natural","طبیعی","#d7c39f",0],[sid(218),sid(203),"charcoal","ذغالی","#3f4447",1],
    [sid(219),sid(204),"matte","مات","#eeeeea",0],
  ];
  for(const [id,raw_product_id,slug,name,hex,sort_order] of colorSpecs) await upsert("raw_product_colors",{id,raw_product_id,slug,name,hex,sort_order,status:"ACTIVE"});
  const sizeSpecs=[
    [sid(230),sid(200),"S",0],[sid(231),sid(200),"M",1],[sid(232),sid(200),"L",2],[sid(233),sid(200),"XL",3],
    [sid(234),sid(201),"M",0],[sid(235),sid(201),"L",1],[sid(236),sid(201),"XL",2],
    [sid(237),sid(202),"۳۳۰ml",0],[sid(238),sid(203),"استاندارد",0],[sid(239),sid(204),"A4",0],[sid(240),sid(204),"A3",1],
  ];
  for(const [id,raw_product_id,name,sort_order] of sizeSpecs) await upsert("raw_product_sizes",{id,raw_product_id,name,label:name,sort_order,status:"ACTIVE"});
  const rawVariants=[
    [sid(250),sid(200),sid(210),sid(231),"TEE-BLK-M"],[sid(251),sid(200),sid(211),sid(232),"TEE-WHT-L"],[sid(252),sid(200),sid(212),sid(233),"TEE-LIL-XL"],
    [sid(253),sid(201),sid(213),sid(235),"HD-BLK-L"],[sid(254),sid(201),sid(214),sid(236),"HD-CRM-XL"],
    [sid(255),sid(202),sid(215),sid(237),"MUG-WHT-330"],[sid(256),sid(202),sid(216),sid(237),"MUG-CRM-330"],
    [sid(257),sid(203),sid(217),sid(238),"TOTE-NAT-STD"],[sid(258),sid(203),sid(218),sid(238),"TOTE-CHR-STD"],
    [sid(259),sid(204),sid(219),sid(239),"PST-MAT-A4"],[sid(260),sid(204),sid(219),sid(240),"PST-MAT-A3"],
  ];
  for(const [id,raw_product_id,color_id,size_id,sku] of rawVariants) await upsert("raw_product_variants",{id,raw_product_id,color_id,size_id,sku,additional_cost:0,status:"ACTIVE"});
  const viewSpecs=[
    [sid(270),sid(200),"FRONT",.30,.20,.40,.58],[sid(271),sid(200),"BACK",.29,.19,.42,.60],
    [sid(272),sid(201),"FRONT",.31,.22,.38,.52],[sid(273),sid(201),"BACK",.30,.20,.40,.55],
    [sid(274),sid(202),"FRONT",.20,.22,.60,.50],
    [sid(275),sid(203),"FRONT",.22,.20,.56,.58],[sid(276),sid(203),"BACK",.22,.20,.56,.58],
    [sid(277),sid(204),"FRONT",.08,.08,.84,.84],
  ];
  for(const [id,raw_product_id,side,print_area_x,print_area_y,print_area_width,print_area_height] of viewSpecs) await upsert("raw_product_views",{id,raw_product_id,side,print_area_x,print_area_y,print_area_width,print_area_height});
  for(let rawIndex=0;rawIndex<raws.length;rawIndex++){
    const raw=raws[rawIndex];
    await upsert("raw_product_media",{id:sid(300+rawIndex),raw_product_id:raw.id,file_id:files.rawImage.id,alt_text:`تصویر ${raw.name}`,sort_order:0,is_primary:true});
  }
  for(let index=0;index<rawVariants.length;index++){
    const [variantId,rawId]=rawVariants[index];
    const views=viewSpecs.filter(item=>item[1]===rawId);
    for(let viewIndex=0;viewIndex<views.length;viewIndex++){
      await upsert("raw_product_variant_assets",{
        id:sid(320+index*3+viewIndex),raw_product_variant_id:variantId,raw_product_view_id:views[viewIndex][0],
        background_file_id:files.background.id,overlay_file_id:files.overlay.id,mockup_file_id:files.mockup.id,
      },["raw_product_variant_id","raw_product_view_id"]);
    }
  }

  // Supplier offers -----------------------------------------------------------
  const offers=[
    {id:sid(400),supplier_organization_id:sid(5),facility_id:sid(30),raw_product_id:sid(200),print_method_id:sid(40),base_cost:8060000,lead_time_days:2,capacity_per_day:100,minimum_order_quantity:1,approval_status:"APPROVED",status:"ACTIVE",approved_at:days(-90),approved_by:authIds.admin},
    {id:sid(401),supplier_organization_id:sid(5),facility_id:sid(30),raw_product_id:sid(202),print_method_id:sid(41),base_cost:3900000,lead_time_days:2,capacity_per_day:80,minimum_order_quantity:1,approval_status:"APPROVED",status:"ACTIVE",approved_at:days(-90),approved_by:authIds.admin},
    {id:sid(402),supplier_organization_id:sid(5),facility_id:sid(30),raw_product_id:sid(203),print_method_id:sid(40),base_cost:5400000,lead_time_days:2,capacity_per_day:60,minimum_order_quantity:1,approval_status:"APPROVED",status:"ACTIVE",approved_at:days(-80),approved_by:authIds.admin},
    {id:sid(403),supplier_organization_id:sid(6),facility_id:sid(31),raw_product_id:sid(200),print_method_id:sid(40),base_cost:7800000,lead_time_days:3,capacity_per_day:70,minimum_order_quantity:1,approval_status:"APPROVED",status:"ACTIVE",approved_at:days(-70),approved_by:authIds.admin},
    {id:sid(404),supplier_organization_id:sid(6),facility_id:sid(31),raw_product_id:sid(201),print_method_id:sid(40),base_cost:18400000,lead_time_days:3,capacity_per_day:45,minimum_order_quantity:1,approval_status:"APPROVED",status:"ACTIVE",approved_at:days(-60),approved_by:authIds.admin},
    {id:sid(405),supplier_organization_id:sid(6),facility_id:sid(31),raw_product_id:sid(204),print_method_id:sid(42),base_cost:2400000,lead_time_days:2,capacity_per_day:100,minimum_order_quantity:1,approval_status:"APPROVED",status:"ACTIVE",approved_at:days(-55),approved_by:authIds.admin},
  ];
  for(const offer of offers) await upsert("supplier_offers",offer);
  const offerVariants=[];
  let offerVariantCounter=420;
  for(const offer of offers){
    const eligible=rawVariants.filter(item=>item[1]===offer.raw_product_id);
    for(const variant of eligible){
      const value={id:sid(offerVariantCounter++),supplier_offer_id:offer.id,raw_product_variant_id:variant[0],unit_cost:offer.base_cost,stock_status:"AVAILABLE",stock_quantity:120};
      await upsert("supplier_offer_variants",value,["supplier_offer_id","raw_product_variant_id"]);
      offerVariants.push(value);
    }
  }
  const offerVariant=(offerId,rawVariantId)=>offerVariants.find(item=>item.supplier_offer_id===offerId&&item.raw_product_variant_id===rawVariantId).id;

  // Designs and seller products ----------------------------------------------
  const canvas=(text)=>JSON.stringify({version:1,objects:[{id:"text-1",type:"text",text,x:.2,y:.25,width:.6,height:.2,fontFamily:"Vazirmatn",fontSize:42,color:"#182522"}]});
  const designs=[
    {id:sid(500),store_id:sid(50),owner_user_id:authIds.seller1,raw_product_id:sid(200),name:"نوا مینیمال",schema_version:1,version:2,status:"READY"},
    {id:sid(501),store_id:sid(51),owner_user_id:authIds.seller2,raw_product_id:sid(202),name:"روز خوب",schema_version:1,version:1,status:"READY"},
    {id:sid(502),store_id:sid(52),owner_user_id:authIds.seller3,raw_product_id:sid(203),name:"ابر نرم",schema_version:1,version:3,status:"READY"},
    {id:sid(503),store_id:sid(50),owner_user_id:authIds.seller1,raw_product_id:sid(201),name:"ماه",schema_version:1,version:1,status:"READY"},
    {id:sid(504),store_id:sid(51),owner_user_id:authIds.seller2,raw_product_id:sid(204),name:"شهر",schema_version:1,version:1,status:"READY"},
    {id:sid(505),store_id:sid(52),owner_user_id:authIds.seller3,raw_product_id:sid(200),name:"طرح در انتظار",schema_version:1,version:1,status:"DRAFT"},
  ];
  for(const design of designs) await upsert("designs",design);
  const designRawVariant={ [sid(500)]:sid(250),[sid(501)]:sid(255),[sid(502)]:sid(257),[sid(503)]:sid(253),[sid(504)]:sid(259),[sid(505)]:sid(251) };
  for(const design of designs){
    const views=viewSpecs.filter(item=>item[1]===design.raw_product_id);
    for(let index=0;index<views.length;index++){
      await upsert("design_views",{
        id:sid(520+designs.indexOf(design)*3+index),design_id:design.id,raw_product_view_id:views[index][0],
        canvas_document:canvas(design.name),source_file_id:files.design.id,preview_file_id:files.product.id,
        printable_export_file_id:files.printable.id,validation_state:"VALID",validation_messages:JSON.stringify([]),
      },["design_id","raw_product_view_id"]);
    }
    await upsert("design_variants",{design_id:design.id,raw_product_variant_id:designRawVariant[design.id]},["design_id","raw_product_variant_id"]);
  }
  const products=[
    {id:sid(600),store_id:sid(50),raw_product_id:sid(200),design_id:sid(500),primary_supplier_offer_id:sid(400),backup_supplier_offer_id:sid(403),slug:"nava-oversized-tshirt",title:"تیشرت اورسایز نوا",subtitle:"پنبه سنگین، چاپ بادوام",description:"تیشرت اورسایز با پارچه پنبه‌ای لطیف و ضخیم، دوخت تقویت‌شده و چاپ باکیفیت.",price:12900000,discounted_price:10900000,status:"PUBLISHED",moderation_status:"APPROVED",rating_average:4.8,review_count:126,sales_count:420,view_count:12400,is_featured:true,published_at:days(-120)},
    {id:sid(601),store_id:sid(51),raw_product_id:sid(202),design_id:sid(501),primary_supplier_offer_id:sid(401),backup_supplier_offer_id:null,slug:"rooz-ceramic-mug",title:"ماگ سرامیکی روز خوب",subtitle:"چاپ دوطرفه و قابل شست‌وشو",description:"ماگ سرامیکی لعاب‌دار با چاپ مقاوم و بسته‌بندی ایمن.",price:6900000,discounted_price:5900000,status:"PUBLISHED",moderation_status:"APPROVED",rating_average:4.7,review_count:84,sales_count:310,view_count:9700,is_featured:true,published_at:days(-100)},
    {id:sid(602),store_id:sid(52),raw_product_id:sid(203),design_id:sid(502),primary_supplier_offer_id:sid(402),backup_supplier_offer_id:null,slug:"abr-canvas-tote",title:"توت‌بگ کتان ابر",subtitle:"پارچه ضخیم، دسته تقویت‌شده",description:"کیف پارچه‌ای جادار از کتان ضخیم با دسته‌های مقاوم و چاپ دوستدار محیط‌زیست.",price:8900000,discounted_price:null,status:"PUBLISHED",moderation_status:"APPROVED",rating_average:4.9,review_count:57,sales_count:206,view_count:6800,is_featured:false,published_at:days(-80)},
    {id:sid(603),store_id:sid(50),raw_product_id:sid(201),design_id:sid(503),primary_supplier_offer_id:sid(404),backup_supplier_offer_id:null,slug:"maah-hoodie",title:"هودی مینیمال ماه",subtitle:"داخل کرکی و مناسب چهار فصل",description:"هودی نرم و خوش‌فرم با چاپ مینیمال و پارچه مقاوم.",price:28900000,discounted_price:24900000,status:"PUBLISHED",moderation_status:"APPROVED",rating_average:4.8,review_count:91,sales_count:170,view_count:8100,is_featured:true,published_at:days(-70)},
    {id:sid(604),store_id:sid(51),raw_product_id:sid(204),design_id:sid(504),primary_supplier_offer_id:sid(405),backup_supplier_offer_id:null,slug:"shahr-art-poster",title:"پوستر هنری شهر",subtitle:"چاپ هنری روی کاغذ مات",description:"پوستر مینیمال با چاپ دقیق روی کاغذ هنری مات.",price:5900000,discounted_price:5200000,status:"PUBLISHED",moderation_status:"APPROVED",rating_average:4.6,review_count:42,sales_count:138,view_count:5400,is_featured:false,published_at:days(-50)},
    {id:sid(605),store_id:sid(52),raw_product_id:sid(200),design_id:sid(505),primary_supplier_offer_id:sid(400),backup_supplier_offer_id:sid(403),slug:"main-character-pending",title:"تیشرت Main Character",subtitle:"برای روزهای نقش اول",description:"طرح تازه‌ای که منتظر تأیید تیم چاپلی است.",price:13900000,discounted_price:null,status:"PENDING",moderation_status:"PENDING",rating_average:0,review_count:0,sales_count:0,view_count:0,is_featured:false,published_at:null},
    {id:sid(606),store_id:sid(51),raw_product_id:sid(202),design_id:sid(501),primary_supplier_offer_id:sid(401),backup_supplier_offer_id:null,slug:"coffee-first-rejected",title:"ماگ قهوه اول",subtitle:"نسخه نیازمند اصلاح",description:"محصول ردشده برای نمایش گردش moderation.",price:7200000,discounted_price:null,status:"REJECTED",moderation_status:"REJECTED",rating_average:0,review_count:0,sales_count:0,view_count:0,is_featured:false,published_at:null},
    {id:sid(607),store_id:sid(50),raw_product_id:sid(200),design_id:sid(500),primary_supplier_offer_id:sid(400),backup_supplier_offer_id:sid(403),slug:"draft-color-drop",title:"دراپ رنگی آینده",subtitle:"پیش‌نویس ذخیره‌شده",description:"نمونه پیش‌نویس قابل ادامه.",price:14900000,discounted_price:null,status:"DRAFT",moderation_status:"PENDING",rating_average:0,review_count:0,sales_count:0,view_count:0,is_featured:false,published_at:null},
  ];
  for(const product of products) await upsert("seller_products",product);
  const productVariantSpecs=[
    [sid(620),sid(600),sid(250),offerVariant(sid(400),sid(250)),offerVariant(sid(403),sid(250)),"NAVA-TEE-BLK-M",12900000,14900000],
    [sid(621),sid(600),sid(251),offerVariant(sid(400),sid(251)),offerVariant(sid(403),sid(251)),"NAVA-TEE-WHT-L",12900000,14900000],
    [sid(622),sid(601),sid(255),offerVariant(sid(401),sid(255)),null,"ROOZ-MUG-WHT",6900000,7900000],
    [sid(623),sid(602),sid(257),offerVariant(sid(402),sid(257)),null,"ABR-TOTE-NAT",8900000,null],
    [sid(624),sid(603),sid(253),offerVariant(sid(404),sid(253)),null,"MAAH-HD-BLK-L",28900000,31900000],
    [sid(625),sid(604),sid(259),offerVariant(sid(405),sid(259)),null,"SHAHR-PST-A4",5900000,6900000],
    [sid(626),sid(605),sid(251),offerVariant(sid(400),sid(251)),offerVariant(sid(403),sid(251)),"MAIN-TEE-WHT-L",13900000,null],
    [sid(627),sid(606),sid(256),offerVariant(sid(401),sid(256)),null,"COFFEE-MUG-CRM",7200000,null],
    [sid(628),sid(607),sid(252),offerVariant(sid(400),sid(252)),offerVariant(sid(403),sid(252)),"DRAFT-TEE-LIL",14900000,null],
  ];
  for(const [id,seller_product_id,raw_product_variant_id,supplier_offer_variant_id,backup_supplier_offer_variant_id,sku,priceValue,compare_at_price] of productVariantSpecs){
    await upsert("seller_product_variants",{id,seller_product_id,raw_product_variant_id,supplier_offer_variant_id,backup_supplier_offer_variant_id,sku,price:priceValue,compare_at_price,status:"ACTIVE"});
  }
  for(let index=0;index<products.length;index++){
    await upsert("product_images",{id:sid(650+index),seller_product_id:products[index].id,file_id:files.product.id,alt_text:`تصویر ${products[index].title}`,sort_order:0,is_primary:true});
    for(const [detailIndex,detail] of [["جنس","کیفیت درجه یک"],["زمان ارسال","حداکثر ۷۲ ساعت"],["روش نگهداری","شست‌وشوی ملایم"]].entries()){
      await upsert("product_details",{id:sid(680+index*3+detailIndex),seller_product_id:products[index].id,title:detail[0],value:detail[1],sort_order:detailIndex});
    }
  }
  const tags=[["original","اورجینال"],["trendy","ترند"],["gift","هدیه"],["minimal","مینیمال"],["fun","بامزه"]];
  for(let index=0;index<tags.length;index++) await upsert("tags",{id:sid(720+index),slug:tags[index][0],name:tags[index][1]},["slug"]);
  for(const product of products.slice(0,5)){
    await upsert("product_tags",{seller_product_id:product.id,tag_id:sid(720+(products.indexOf(product)%tags.length))},["seller_product_id","tag_id"]);
    await upsert("product_tags",{seller_product_id:product.id,tag_id:sid(723)},["seller_product_id","tag_id"]);
  }
  const styles=[
    {id:sid(740),slug:"colorful-minimal",name:"مینیمال رنگی",caption:"کمی، ولی خیلی توی چشم",status:"ACTIVE",sort_order:1},
    {id:sid(741),slug:"fun-typography",name:"تایپوگرافی بامزه",caption:"حرفی که ارزش پوشیدن دارد",status:"ACTIVE",sort_order:2},
    {id:sid(742),slug:"urban-graphic",name:"گرافیک شهری",caption:"برای مود خیابان",status:"ACTIVE",sort_order:3},
    {id:sid(743),slug:"soft-illustration",name:"تصویرسازی نرم",caption:"آرام و خیال‌باف",status:"ACTIVE",sort_order:4},
  ];
  for(const style of styles) await upsert("graphic_styles",style,["slug"]);
  const styleMap=[[sid(600),sid(740)],[sid(601),sid(741)],[sid(602),sid(743)],[sid(603),sid(740)],[sid(604),sid(742)]];
  for(const [seller_product_id,graphic_style_id] of styleMap) await upsert("product_graphic_styles",{seller_product_id,graphic_style_id},["seller_product_id","graphic_style_id"]);
  await upsert("product_videos",{id:sid(760),seller_product_id:sid(600),file_id:files.product.id,caption:"نمای نزدیک محصول",sort_order:0});
  await upsert("product_videos",{id:sid(761),seller_product_id:sid(602),file_id:files.product.id,caption:"توت‌بگ در استفاده روزمره",sort_order:0});

  // Homepage merchandising and reels -----------------------------------------
  await upsert("homepage_banners",{id:sid(780),seed_key:"drop-01",eyebrow:"DROP 01",title:"لباس‌هایی که قبل از حرف‌زدنت، معرفیت می‌کنن.",body:"دراپ تازه استودیوهای مستقل؛ محدود، واقعی و بدون حس کپی.",desktop_file_id:files.banner.id,mobile_file_id:files.product.id,cta_label:"دراپ را ببین",cta_url:"/search?sort=newest",tone:"coral",placement:"HOME",status:"ACTIVE",sort_order:1},["seed_key"]);
  await upsert("homepage_banners",{id:sid(781),seed_key:"gift-guide",eyebrow:"برای رفیق سخت‌پسند",title:"هدیه‌ای که واقعاً شبیه خودش باشد.",body:"انتخاب‌های بامزه، خاص و دور از کلیشه.",desktop_file_id:files.banner.id,mobile_file_id:files.product.id,cta_label:"هدیه پیدا کن",cta_url:"/search?tag=gift",tone:"mint",placement:"HOME",status:"ACTIVE",sort_order:2},["seed_key"]);
  const reels=[
    {id:sid(790),store_id:sid(50),seller_product_id:sid(600),video_file_id:files.product.id,caption:"وقتی می‌خوای ساده باشه، ولی معمولی نه ✨",status:"PUBLISHED",like_count:2840,save_count:610,published_at:days(-3)},
    {id:sid(791),store_id:sid(51),seller_product_id:sid(601),video_file_id:files.product.id,caption:"POV: ماگی که مود صبح رو نجات می‌ده ☕",status:"PUBLISHED",like_count:1930,save_count:440,published_at:days(-5)},
    {id:sid(792),store_id:sid(52),seller_product_id:sid(602),video_file_id:files.product.id,caption:"از اسکیس تا چیزی که هر روز همراهته ☁️",status:"PUBLISHED",like_count:1270,save_count:350,published_at:days(-7)},
  ];
  for(const reel of reels) await upsert("reel_posts",reel);
  await upsert("reel_likes",{reel_id:sid(790),user_id:authIds.buyer1},["reel_id","user_id"]);
  await upsert("reel_saves",{reel_id:sid(790),user_id:authIds.buyer1},["reel_id","user_id"]);

  // Buyer addresses -----------------------------------------------------------
  await upsert("buyer_addresses",{id:sid(800),user_id:authIds.buyer1,label:"خانه",recipient_name:"سارا احمدی",phone:"09121234567",province:"تهران",city:"تهران",address_line:"خیابان انقلاب، کوچه روشن، پلاک ۱۲، واحد ۳",postal_code:"1314512345",delivery_note:"با نگهبانی هماهنگ شود",is_default:true});
  await upsert("buyer_addresses",{id:sid(801),user_id:authIds.buyer2,label:"محل کار",recipient_name:"آرین محمدی",phone:"09129876543",province:"البرز",city:"کرج",address_line:"بلوار جمهوری، ساختمان آفتاب، طبقه ۲",postal_code:"3147612345",delivery_note:null,is_default:true});

  // Orders and fulfilments in multiple states --------------------------------
  const orderSpecs=[
    {id:sid(900),number:"CH-DEMO-1001",buyer:authIds.buyer1,status:"DONE",variant:sid(620),product:sid(600),sellerOrg:sid(2),supplierOrg:sid(5),offer:sid(400),facility:sid(30),unit:12900000,cost:8060000,qty:1,created:days(-25),fulfilment:"DONE"},
    {id:sid(901),number:"CH-DEMO-1002",buyer:authIds.buyer2,status:"DONE",variant:sid(625),product:sid(604),sellerOrg:sid(3),supplierOrg:sid(6),offer:sid(405),facility:sid(31),unit:5900000,cost:2400000,qty:2,created:days(-20),fulfilment:"DONE"},
    {id:sid(902),number:"CH-DEMO-1003",buyer:authIds.buyer1,status:"SENT",variant:sid(623),product:sid(602),sellerOrg:sid(4),supplierOrg:sid(5),offer:sid(402),facility:sid(30),unit:8900000,cost:5400000,qty:1,created:days(-6),fulfilment:"SENT"},
    {id:sid(903),number:"CH-DEMO-1004",buyer:authIds.buyer2,status:"IN_PRODUCTION",variant:sid(624),product:sid(603),sellerOrg:sid(2),supplierOrg:sid(6),offer:sid(404),facility:sid(31),unit:28900000,cost:18400000,qty:1,created:days(-3),fulfilment:"IN_PRODUCTION"},
    {id:sid(904),number:"CH-DEMO-1005",buyer:authIds.buyer1,status:"CONFIRMED",variant:sid(622),product:sid(601),sellerOrg:sid(3),supplierOrg:sid(5),offer:sid(401),facility:sid(30),unit:6900000,cost:3900000,qty:1,created:days(-1),fulfilment:"ASSIGNED"},
    {id:sid(905),number:"CH-DEMO-1006",buyer:authIds.buyer2,status:"CANCELLED",variant:sid(621),product:sid(600),sellerOrg:sid(2),supplierOrg:sid(5),offer:sid(400),facility:sid(30),unit:12900000,cost:8060000,qty:1,created:days(-10),fulfilment:"CANCELLED"},
  ];
  for(let index=0;index<orderSpecs.length;index++){
    const order=orderSpecs[index],subtotal=order.unit*order.qty,shipping=subtotal>=15000000?0:790000;
    await upsert("orders",{id:order.id,number:order.number,buyer_user_id:order.buyer,status:order.status,subtotal,total:subtotal+shipping,currency:"IRR",customer_snapshot:JSON.stringify({name:order.buyer===authIds.buyer1?"سارا احمدی":"آرین محمدی"}),shipping_address_snapshot:JSON.stringify({city:order.buyer===authIds.buyer1?"تهران":"کرج"}),shipping_address_id:order.buyer===authIds.buyer1?sid(800):sid(801),shipping_amount:shipping,discount_amount:0,tax_amount:0,idempotency_key:`seed-order-${index}`,paid_at:order.status==="CANCELLED"?null:order.created,completed_at:order.status==="DONE"?days(-10):null,created_at:order.created});
    const orderItemId=sid(920+index),fulfilmentId=sid(940+index);
    const product=products.find(item=>item.id===order.product);
    const rawVariant=productVariantSpecs.find(item=>item[0]===order.variant)[2];
    const supplierOfferVariant=productVariantSpecs.find(item=>item[0]===order.variant)[3];
    await upsert("order_items",{id:orderItemId,order_id:order.id,seller_product_id:order.product,seller_product_variant_id:order.variant,raw_product_variant_id:rawVariant,supplier_offer_variant_id:supplierOfferVariant,seller_organization_id:order.sellerOrg,supplier_organization_id:order.supplierOrg,quantity:order.qty,unit_price:order.unit,cost_snapshot:order.cost,line_total:subtotal,product_snapshot:JSON.stringify({title:product.title,seed:true}),design_snapshot:JSON.stringify({version:1,front:{objects:[]}}),created_at:order.created});
    await upsert("fulfilments",{id:fulfilmentId,order_id:order.id,supplier_organization_id:order.supplierOrg,facility_id:order.facility,supplier_offer_id:order.offer,assignment_snapshot:JSON.stringify({seed:true,offerId:order.offer}),status:order.fulfilment,tracking_code:["SENT","DONE"].includes(order.fulfilment)?`POST-DEMO-${1000+index}`:null,sent_at:["SENT","DONE"].includes(order.fulfilment)?days(-index-2):null,auto_complete_at:order.fulfilment==="SENT"?days(4):null,done_at:order.fulfilment==="DONE"?days(-10):null,cancelled_at:order.fulfilment==="CANCELLED"?days(-9):null,due_at:days(index-2),version:2,created_at:order.created});
    await upsert("fulfilment_items",{id:sid(960+index),fulfilment_id:fulfilmentId,order_item_id:orderItemId,quantity:order.qty});
    await insertIgnore("fulfilment_status_events",{id:sid(980+index),fulfilment_id:fulfilmentId,from_status:null,to_status:order.fulfilment,actor_type:"SYSTEM",actor_id:null,idempotency_key:`seed-fulfilment-${index}`,occurred_at:order.created},["idempotency_key"]);
    await upsert("fulfilment_files",{fulfilment_id:fulfilmentId,file_id:files.printable.id,purpose:"PRINT_FRONT"},["fulfilment_id","file_id","purpose"]);
    if(["SENT","DONE"].includes(order.fulfilment)){
      await upsert("shipments",{id:sid(1000+index),fulfilment_id:fulfilmentId,carrier:"پست",service:"پیشتاز",tracking_code:`POST-DEMO-${1000+index}`,status:order.fulfilment==="DONE"?"DELIVERED":"IN_TRANSIT",shipped_at:days(-index-2),delivered_at:order.fulfilment==="DONE"?days(-10):null});
      await upsert("tracking_events",{id:sid(1020+index),shipment_id:sid(1000+index),status:order.fulfilment==="DONE"?"DELIVERED":"IN_TRANSIT",description:order.fulfilment==="DONE"?"تحویل گیرنده شد":"در مسیر مرکز مقصد",location:"تهران",provider_event_id:`seed-track-${index}`,occurred_at:days(-index)});
    }
    if(order.status!=="CANCELLED") await upsert("payments",{id:sid(1040+index),order_id:order.id,provider:"DEMO",provider_payment_id:`PAY-DEMO-${index}`,idempotency_key:`seed-payment-${index}`,amount:subtotal+shipping,currency:"IRR",status:"CAPTURED",provider_response:JSON.stringify({seed:true}),captured_at:order.created,created_at:order.created});
  }
  await upsert("reviews",{id:sid(1060),buyer_user_id:authIds.buyer1,seller_product_id:sid(600),order_item_id:sid(920),rating:5,title:"واقعاً باکیفیت",body:"پارچه و چاپ خیلی بهتر از انتظارم بود.",status:"PUBLISHED",is_verified_purchase:true,created_at:days(-8)});
  await upsert("wishlist_items",{user_id:authIds.buyer1,seller_product_id:sid(603)},["user_id","seller_product_id"]);
  await upsert("wishlist_items",{user_id:authIds.buyer1,seller_product_id:sid(604)},["user_id","seller_product_id"]);
  await upsert("recent_product_views",{user_id:authIds.buyer1,seller_product_id:sid(600),viewed_at:days(-1),view_count:3},["user_id","seller_product_id"]);
  await upsert("recent_product_views",{user_id:authIds.buyer1,seller_product_id:sid(602),viewed_at:days(-2),view_count:1},["user_id","seller_product_id"]);

  // Earnings, balances, bank accounts, and payouts ---------------------------
  const bankAccounts=[
    {id:sid(1100),organization_id:sid(2),bank_name:"بانک ملت",card_number:"6104337812344210",iban:"IR5401200000009876321001",priority:1,status:"ACTIVE",account_holder_name:"نیلوفر راد",verified_at:days(-60)},
    {id:sid(1101),organization_id:sid(3),bank_name:"بانک پاسارگاد",card_number:"5022291012348403",iban:"IR1905700000001130827465",priority:1,status:"ACTIVE",account_holder_name:"پارسا کریمی",verified_at:days(-50)},
    {id:sid(1102),organization_id:sid(4),bank_name:"بانک سامان",card_number:"6219861012345544",iban:"IR2205600000008866210022",priority:1,status:"ACTIVE",account_holder_name:"ترانه صادقی",verified_at:days(-40)},
    {id:sid(1103),organization_id:sid(5),bank_name:"بانک تجارت",card_number:"6273531012349901",iban:"IR3301800000007722900099",priority:1,status:"ACTIVE",account_holder_name:"چاپ اطلس ایرانیان",verified_at:days(-80)},
    {id:sid(1104),organization_id:sid(6),bank_name:"بانک ملی",card_number:"6037991012342231",iban:"IR4401700000006611800088",priority:1,status:"ACTIVE",account_holder_name:"ماهور نقش رنگین",verified_at:days(-70)},
  ];
  for(const account of bankAccounts) await upsert("bank_accounts",account);
  const earnings=[
    {id:sid(1120),beneficiary_organization_id:sid(2),earning_type:"SELLER",source_type:"ORDER_ITEM",source_id:sid(920),order_id:sid(900),order_item_id:sid(920),fulfilment_id:sid(940),gross_amount:4840000,fee_amount:1290000,net_amount:3550000,status:"RESERVED",available_at:days(-10)},
    {id:sid(1121),beneficiary_organization_id:sid(5),earning_type:"SUPPLIER",source_type:"FULFILMENT",source_id:sid(940),order_id:sid(900),order_item_id:sid(920),fulfilment_id:sid(940),gross_amount:8060000,fee_amount:0,net_amount:8060000,status:"PAID",available_at:days(-10),paid_at:days(-5)},
    {id:sid(1122),beneficiary_organization_id:sid(3),earning_type:"SELLER",source_type:"ORDER_ITEM",source_id:sid(921),order_id:sid(901),order_item_id:sid(921),fulfilment_id:sid(941),gross_amount:7000000,fee_amount:1180000,net_amount:5820000,status:"AVAILABLE",available_at:days(-9)},
    {id:sid(1123),beneficiary_organization_id:sid(6),earning_type:"SUPPLIER",source_type:"FULFILMENT",source_id:sid(941),order_id:sid(901),order_item_id:sid(921),fulfilment_id:sid(941),gross_amount:4800000,fee_amount:0,net_amount:4800000,status:"AVAILABLE",available_at:days(-9)},
    {id:sid(1124),beneficiary_organization_id:sid(4),earning_type:"SELLER",source_type:"ADJUSTMENT",source_id:sid(1200),order_id:null,order_item_id:null,fulfilment_id:null,gross_amount:2500000,fee_amount:0,net_amount:2500000,status:"PENDING",available_at:days(4)},
    {id:sid(1125),beneficiary_organization_id:sid(2),earning_type:"SELLER",source_type:"ADJUSTMENT",source_id:sid(1201),order_id:null,order_item_id:null,fulfilment_id:null,gross_amount:4200000,fee_amount:200000,net_amount:4000000,status:"AVAILABLE",available_at:days(-2)},
  ];
  for(const earning of earnings) await upsert("earnings",{currency:"IRR",...earning});
  await upsert("payout_requests",{id:sid(1140),organization_id:sid(2),bank_account_id:sid(1100),amount:3550000,currency:"IRR",status:"REQUESTED",idempotency_key:"seed-payout-pending",requested_at:days(-2)});
  await upsert("payout_request_items",{payout_request_id:sid(1140),earning_id:sid(1120),amount:3550000},["payout_request_id","earning_id"]);
  await upsert("payout_requests",{id:sid(1141),organization_id:sid(5),bank_account_id:sid(1103),amount:8060000,currency:"IRR",status:"PAID",idempotency_key:"seed-payout-paid",requested_at:days(-8),processed_at:days(-5),processed_by:authIds.admin});
  await upsert("payout_request_items",{payout_request_id:sid(1141),earning_id:sid(1121),amount:8060000},["payout_request_id","earning_id"]);
  await upsert("payout_payment_history",{id:sid(1150),payout_request_id:sid(1141),organization_id:sid(5),amount:8060000,currency:"IRR",receipt_file_id:files.receipt.id,receipt_text:"حواله پایا آزمایشی",reference:"DEMO-REF-1001",paid_at:days(-5),admin_id:authIds.admin},["payout_request_id"]);
  for(const orgId of [sid(2),sid(3),sid(4),sid(5),sid(6)]) await q("select public.recalculate_balance($1)",[orgId]);

  // Moderation, templates, and AI usage ---------------------------------------
  await upsert("sms_templates",{id:sid(1160),key:"product-approved",name:"تأیید محصول",body:"محصول {{product}} تأیید و منتشر شد.",status:"ACTIVE"},["key"]);
  await upsert("sms_templates",{id:sid(1161),key:"low-image-quality",name:"کیفیت پایین تصویر",body:"محصول شما به دلیل کیفیت ناکافی تصویر نیاز به اصلاح دارد.",status:"ACTIVE"},["key"]);
  await upsert("sms_templates",{id:sid(1162),key:"ip-risk",name:"احتمال نقض مالکیت",body:"محصول شما به دلیل احتمال نقض حقوق مالکیت تأیید نشد.",status:"ACTIVE"},["key"]);
  await upsert("rejection_reasons",{id:sid(1170),code:"LOW_IMAGE_QUALITY",title:"کیفیت پایین تصویر",sms_template_id:sid(1161),status:"ACTIVE",sort_order:1},["code"]);
  await upsert("rejection_reasons",{id:sid(1171),code:"IP_RISK",title:"نقض حقوق مالکیت",sms_template_id:sid(1162),status:"ACTIVE",sort_order:2},["code"]);
  await upsert("product_moderation_queue",{id:sid(1180),seller_product_id:sid(605),seller_id:authIds.seller3,status:"PENDING",submitted_at:days(-1)});
  await upsert("product_moderation_queue",{id:sid(1181),seller_product_id:sid(606),seller_id:authIds.seller2,status:"REJECTED",submitted_at:days(-7),reviewed_at:days(-6),reviewed_by:authIds.admin,rejection_reason_id:sid(1170),custom_message:"فایل اصلی را با رزولوشن بالاتر آپلود کن."});
  await upsert("product_moderation_decisions",{id:sid(1182),seller_product_id:sid(606),queue_id:sid(1181),decision:"REJECTED",rejection_reason_id:sid(1170),custom_message:"فایل اصلی را با رزولوشن بالاتر آپلود کن.",admin_user_id:authIds.admin});
  await insertIgnore("ai_credit_events",{id:sid(1190),user_id:authIds.seller2,design_id:sid(504),idempotency_key:"seed-ai-credit-used",delta:-1,reason:"AI_IMAGE_GENERATION",created_at:days(-10)},["idempotency_key"]);

  // Tutorials and progress ----------------------------------------------------
  const tutorials=[
    {
      id:sid(1210),seed_key:"first-product",title:"فروشگاهت را از صفر حرفه‌ای بچین",
      summary:"در این مسیر، هویت فروشگاه، مخاطب هدف، ویترین، اطلاعات تماس و تنظیمات اعتماد را طوری می‌چینی که بازدیدکننده در چند ثانیه بفهمد چه چیزی می‌فروشی و چرا باید از تو بخرد.",
      description:"یک فروشگاه خوب فقط لوگوی قشنگ نیست؛ باید در نگاه اول وعده روشن، لحن مشخص و مسیر خرید ساده داشته باشد. این آموزش قدم‌به‌قدم کمک می‌کند قبل از ساخت محصول، پایه‌ای بسازی که همه تصمیم‌های بعدی—از طرح و قیمت تا محتوا—با آن هماهنگ باشند.",
      learning_outcomes:["تعریف دقیق مخاطب و وعده برند","انتخاب نام، رنگ و لحن منسجم","ساخت لوگو و بنر قابل اعتماد","تکمیل اطلاعات ضروری فروشگاه"],
      content:JSON.stringify([
        {title:"مخاطب اصلی را در یک جمله مشخص کن",body:"به‌جای «همه»، یک گروه واقعی را انتخاب کن: مثلاً دانشجوهای علاقه‌مند به تایپوگرافی فارسی یا گیمرهایی که طرح مینیمال دوست دارند. سن، سلیقه، بودجه تقریبی و موقعیتی را بنویس که معمولاً برای آن خرید می‌کنند؛ این جمله قطب‌نمای محصول و محتوای تو می‌شود."},
        {title:"وعده فروشگاه را کوتاه و قابل‌فهم بنویس",body:"در یک جمله بگو چه محصولی، برای چه کسی و با چه تفاوتی می‌سازی. جمله‌هایی مثل «تیشرت‌های تایپوگرافی فارسی برای آدم‌هایی که از طرح تکراری خسته‌اند» از عبارت‌های کلی مثل «بهترین کیفیت» قابل‌باورتر و به‌یادماندنی‌ترند."},
        {title:"نام و آدرس فروشگاه را انتخاب کن",body:"نام باید کوتاه، خوانا، قابل تلفظ و در شبکه‌های اجتماعی قابل جست‌وجو باشد. آدرس انگلیسی فروشگاه را بدون عدد و خط تیره اضافه بساز و قبل از نهایی‌کردن، آن را با صدای بلند بخوان و برای دو نفر بفرست تا مطمئن شوی اشتباه تایپی ایجاد نمی‌کند."},
        {title:"سیستم بصری ساده بساز",body:"یک رنگ اصلی، یک رنگ کمکی و حداکثر دو سبک تایپوگرافی انتخاب کن. لوگو را در اندازه کوچک هم آزمایش کن؛ اگر در آواتار موبایل خوانا نیست، جزئیاتش زیاد است. بنر باید محصول، حال‌وهوا و یک پیام روشن داشته باشد، نه چندین شعار و عنصر رقیب."},
        {title:"اعتماد را قبل از فروش کامل کن",body:"شماره پشتیبانی، ایمیل، توضیح کوتاه فروشگاه و شبکه اجتماعی فعال را وارد کن. درباره زمان ارسال حداکثر ۷۲ ساعته، تضمین کیفیت و شرایط بازگشت شفاف باش؛ ابهام در این بخش‌ها یکی از مهم‌ترین دلایل رهاکردن خرید است."},
        {title:"ویترین را با چشم مشتری بررسی کن",body:"صفحه فروشگاه را روی موبایل باز کن و در پنج ثانیه به سه سؤال جواب بده: چه می‌فروشد؟ سبک آن چیست؟ قدم بعدی کدام است؟ اگر جواب واضح نیست، متن معرفی، بنر یا ترتیب محصولات را ساده‌تر کن."}
      ]),
      difficulty:"BEGINNER",video_file_id:null,thumbnail_file_id:files.product.id,attachment_file_id:null,duration_minutes:25,sort_order:1,status:"PUBLISHED",
    },
    {
      id:sid(1211),seed_key:"store-identity",title:"اولین محصول را درست بساز و منتشر کن",
      summary:"از انتخاب محصول خام و طراحی امن برای چاپ تا ساخت موکاپ، انتخاب تأمین‌کننده و نوشتن اطلاعات محصول؛ تمام مسیر انتشار اولین محصول را بدون جاانداختن مرحله مهم یاد می‌گیری.",
      description:"اولین محصول قرار نیست کامل‌ترین محصول دنیا باشد، اما باید از نظر فایل چاپ، انتخاب رنگ و سایز، موکاپ، قیمت و توضیحات قابل اعتماد باشد. این چک‌لیست مسیر ساخت محصول در چاپلی را به بخش‌های کوچک و قابل اجرا تقسیم می‌کند.",
      learning_outcomes:["انتخاب محصول خام مناسب طرح","آماده‌سازی فایل چاپ استاندارد","طراحی برای جلو و پشت محصول","انتخاب تأمین‌کننده و انتشار محصول"],
      content:JSON.stringify([
        {title:"دسته و محصول خام را بر اساس کاربرد انتخاب کن",body:"اول مشخص کن مشتری محصول را کجا و چند وقت یک‌بار استفاده می‌کند. برای شروع محصولی انتخاب کن که هم مخاطبت آن را می‌شناسد و هم طرح تو روی سطح چاپ آن واضح دیده می‌شود؛ تنوع زیاد رنگ و سایز در محصول اول می‌تواند تصمیم‌گیری و کنترل کیفیت را سخت کند."},
        {title:"فایل طراحی را برای چاپ آماده کن",body:"طرح را با کیفیت بالا، پس‌زمینه شفاف و رنگ‌های کنترل‌شده خروجی بگیر. متن‌های ریز، خطوط بسیار نازک و عناصر نزدیک لبه ناحیه چاپ ممکن است در محصول واقعی ضعیف دیده شوند؛ در بزرگ‌نمایی ۱۰۰٪ همه جزئیات را بررسی کن."},
        {title:"طراحی را داخل محدوده چاپ قرار بده",body:"در ادیتور، طرح را روی ناحیه مجاز نگه دار و فاصله امن از لبه‌ها را رعایت کن. اگر محصول نمای پشت دارد، هر نما را جداگانه طراحی و چند بار بین جلو و پشت جابه‌جا شو تا هیچ لایه‌ای جا نمانده باشد."},
        {title:"رنگ‌ها و سایزهای قابل فروش را محدود و هوشمند انتخاب کن",body:"رنگ‌هایی را فعال کن که کنتراست کافی با طرح دارند؛ یک طرح روشن روی محصول روشن معمولاً در موکاپ جذاب نیست. فقط سایزهایی را منتشر کن که تأمین‌کننده اصلی و پشتیبان هر دو واقعاً پشتیبانی می‌کنند تا احتمال لغو سفارش کمتر شود."},
        {title:"موکاپ را مثل عکس اصلی فروشگاه ببین",body:"موکاپ باید طرح را واضح، بدون کشیدگی و در اندازه واقعی نشان دهد. تصویر اول را ساده و سریع‌فهم انتخاب کن، سپس نماهای نزدیک‌تر یا رنگ‌های دیگر را اضافه کن. اگر خودت در دو ثانیه محصول را تشخیص نمی‌دهی، مشتری هم تشخیص نمی‌دهد."},
        {title:"اطلاعات محصول را کامل و انسانی بنویس",body:"عنوان را با نوع محصول و ویژگی متمایز شروع کن. در توضیح کوتاه، حس و کاربرد محصول را بگو؛ در جزئیات، جنس، روش نگهداری، رنگ‌ها و اطلاعات واقعی را وارد کن. از ادعاهای غیرقابل اثبات و تکرار کلمات کلیدی پرهیز کن."},
        {title:"تأمین‌کننده و نسخه پشتیبان را انتخاب و بازبینی کن",body:"هزینه، پوشش رنگ و سایز و سابقه تأمین‌کنندگان را مقایسه کن. قبل از انتشار، قیمت، تخفیف، تصاویر، تنوع‌ها، املای متن و لینک فروشگاه را یک بار روی موبایل مرور کن؛ سپس محصول را برای بررسی ارسال کن."}
      ]),
      difficulty:"BEGINNER",video_file_id:null,thumbnail_file_id:files.product.id,attachment_file_id:files.design.id,duration_minutes:35,sort_order:2,status:"PUBLISHED",
    },
    {
      id:sid(1212),seed_key:"pricing",title:"قیمت‌گذاری سودآور، بدون عددسازی",
      summary:"هزینه واقعی، سود هدف، تخفیف و نقطه سربه‌سر را حساب می‌کنی و یاد می‌گیری قیمتی بسازی که هم برای مشتری قابل دفاع باشد و هم رشد فروشگاه را تأمین کند.",
      description:"قیمت پایین همیشه فروش بیشتر نمی‌سازد و قیمت بالا هم بدون ارزش قابل لمس کار نمی‌کند. در این آموزش یک چارچوب ساده برای محاسبه قیمت پایه، سود، تخفیف و ارزیابی نتیجه کمپین می‌سازی.",
      learning_outcomes:["محاسبه هزینه و سود واقعی","تعیین قیمت پایه قابل دفاع","طراحی تخفیف بدون نابودی حاشیه سود","تحلیل نقطه سربه‌سر"],
      content:JSON.stringify([
        {title:"تمام هزینه‌های مستقیم را ثبت کن",body:"هزینه محصول خام، چاپ، بسته‌بندی و سهم‌های مشخص هر سفارش را کنار هم بگذار. فقط به عدد محصول خام نگاه نکن؛ هزینه‌های کوچک اگر در تعداد بالا تکرار شوند بخش قابل توجهی از سود را می‌گیرند."},
        {title:"سود هدف را با مبلغ بسنج، نه فقط درصد",body:"مشخص کن از هر فروش حداقل چه مبلغی باید برای تو بماند تا تولید محتوا، طراحی و رشد فروشگاه منطقی باشد. درصد سود روی محصولات ارزان و گران نتیجه یکسانی ندارد؛ مبلغ خالص هر سفارش معیار تصمیم نهایی است."},
        {title:"بازه قیمت بازار را درست مقایسه کن",body:"محصول‌هایی با جنس، کیفیت چاپ، طراحی و تجربه خرید مشابه را بررسی کن؛ ارزان‌ترین محصول بازار معیار مناسبی نیست. تفاوت خودت—طرح اورجینال، جامعه مخاطب، کیفیت ارائه یا داستان برند—را در کنار قیمت بنویس."},
        {title:"قیمت پایه و قیمت مقایسه‌ای را صادقانه تعیین کن",body:"قیمت اصلی باید همان عددی باشد که واقعاً قصد فروش پایدار با آن را داری. قیمت مقایسه‌ای را فقط برای نمایش تخفیف واقعی استفاده کن؛ تخفیف دائمی و غیرواقعی اعتماد مشتری و ارزش برند را کاهش می‌دهد."},
        {title:"کمپین تخفیف را از آخر به اول حساب کن",body:"قبل از تعیین درصد تخفیف، مبلغ خالص بعد از تخفیف را محاسبه کن و مطمئن شو زیر حداقل سود نمی‌روی. برای افزایش میانگین سبد، تخفیف خرید دوم یا ارسال رایگان بالای یک مبلغ مشخص معمولاً از تخفیف بی‌هدف روی همه محصولات بهتر است."},
        {title:"سه سناریوی فروش بساز",body:"برای فروش کم، متوسط و خوب تعداد سفارش، فروش کل و سود خالص را بنویس. این سناریوها کمک می‌کنند بودجه محتوا و تبلیغات را بدون خیال‌پردازی تعیین کنی و بدانـی برای رسیدن به هدف ماهانه چند سفارش لازم داری."},
        {title:"هر ماه بر اساس داده اصلاح کن",body:"نرخ تبدیل، تعداد افزودن به سبد، فروش هر محصول و سود خالص را کنار هم ببین. محصول پربازدید بدون فروش ممکن است مشکل قیمت یا صفحه محصول داشته باشد؛ محصول پرفروش با سود کم هم لزوماً محصول قهرمان نیست."}
      ]),
      difficulty:"INTERMEDIATE",video_file_id:null,thumbnail_file_id:files.product.id,attachment_file_id:files.design.id,duration_minutes:30,sort_order:3,status:"PUBLISHED",
    },
    {
      id:sid(1213),seed_key:"reels",title:"صفحه محصولی بساز که تردید را کم کند",
      summary:"یاد می‌گیری تصویر، عنوان، توضیح، جزئیات، تنوع‌ها و اعتمادسازها را با چه ترتیبی بچینی تا مشتری سریع‌تر محصول را بفهمد و با اطمینان به سبد خرید اضافه کند.",
      description:"صفحه محصول فروشنده خاموش توست. مشتری نمی‌تواند جنس را لمس کند یا همان لحظه سؤال بپرسد، پس هر تصویر و جمله باید یک تردید واقعی را جواب بدهد و مسیر انتخاب را کوتاه‌تر کند.",
      learning_outcomes:["ساخت گالری محصول قانع‌کننده","نوشتن عنوان و توضیح تبدیل‌محور","ارائه شفاف رنگ، سایز و جزئیات","کاهش اصطکاک تصمیم خرید"],
      content:JSON.stringify([
        {title:"تصویر اول را برای توقف اسکرول انتخاب کن",body:"محصول باید بزرگ، روشن و بدون شلوغی دیده شود. تصویر اول را با پس‌زمینه‌ای انتخاب کن که رنگ محصول و طرح از آن جدا باشد؛ متن تبلیغاتی زیاد روی تصویر، تشخیص محصول را سخت می‌کند."},
        {title:"گالری را به ترتیب سؤال‌های مشتری بچین",body:"بعد از نمای اصلی، نمای نزدیک چاپ، پشت محصول، رنگ‌های مهم و یک تصویر کاربردی قرار بده. هر تصویر باید اطلاعات جدید بدهد؛ چند موکاپ تقریباً مشابه فقط زمان و حجم صفحه را زیاد می‌کند."},
        {title:"عنوان را دقیق و قابل جست‌وجو بنویس",body:"نوع محصول، ویژگی طرح و در صورت نیاز سبک یا کاربرد را در عنوان بیاور؛ مثل «تیشرت اورسایز تایپوگرافی فارسی طرح شب». از عنوان‌های مبهم، ایموجی زیاد و تکرار مصنوعی کلمات کلیدی دوری کن."},
        {title:"توضیح کوتاه را برای تصمیم سریع بنویس",body:"در دو یا سه جمله بگو محصول چه حس و کاربردی دارد، برای چه کسی مناسب است و تفاوت اصلی‌اش چیست. متن را با ویژگی فنی شروع نکن؛ ابتدا دلیل علاقه مشتری و بعد جزئیات لازم را بیاور."},
        {title:"جزئیات و انتخاب تنوع را بدون ابهام کامل کن",body:"جنس، نوع چاپ، راهنمای نگهداری، رنگ‌های واقعی و سایزهای موجود را دقیق ثبت کن. نام تنوع‌ها باید با تصویر هماهنگ باشد و گزینه ناموجود نباید مشتری را تا آخر مسیر خرید جلو ببرد."},
        {title:"اعتمادسازها را نزدیک تصمیم خرید نگه دار",body:"تضمین کیفیت، هفت روز ضمانت بازگشت، ارسال حداکثر تا ۷۲ ساعت و فروشنده تأییدشده را نزدیک قیمت و دکمه خرید نمایش بده. این اطلاعات باید کوتاه، مشخص و قابل دسترسی به متن کامل قوانین باشند."},
        {title:"صفحه را با آزمون پنج‌ثانیه بررسی کن",body:"صفحه را برای کسی که محصول را نمی‌شناسد باز کن و بعد از پنج ثانیه بپرس چه چیزی دید، قیمت چقدر بود و چرا متفاوت است. هر پاسخ نامشخص، یک اولویت واقعی برای اصلاح صفحه است."}
      ]),
      difficulty:"INTERMEDIATE",video_file_id:null,thumbnail_file_id:files.product.id,attachment_file_id:null,duration_minutes:28,sort_order:4,status:"PUBLISHED",
    },
    {
      id:sid(1214),seed_key:"launch-content-orders",title:"از لانچ تا مشتری وفادار؛ برنامه ۱۴ روزه",
      summary:"یک برنامه عملی برای معرفی محصول، ساخت ریلز، پاسخ به مشتری، پیگیری سفارش و تحلیل فروش می‌سازی تا انتشار محصول به چند استوری پراکنده محدود نشود.",
      description:"فروش بعد از زدن دکمه انتشار شروع می‌شود. این آموزش یک برنامه دو هفته‌ای می‌دهد تا قبل از لانچ کنجکاوی بسازی، روز عرضه پیام روشن داشته باشی و بعد از خرید تجربه‌ای بسازی که مشتری دوباره برگردد.",
      learning_outcomes:["طراحی برنامه پیش‌لانچ و لانچ","ساخت محتوای کوتاه قابل تکرار","مدیریت پیام و سفارش مشتری","تحلیل و بهبود کمپین"],
      content:JSON.stringify([
        {title:"هدف و عدد موفقیت را تعیین کن",body:"قبل از تولید محتوا مشخص کن هدف لانچ فروش، جمع‌کردن بازدید یا آزمایش یک طرح جدید است. یک عدد اصلی مثل ۳۰ سفارش یا نرخ تبدیل مشخص انتخاب کن تا بعداً موفقیت را با حس شخصی نسنجی."},
        {title:"هفت روز قبل، مسئله و پشت‌صحنه را نشان بده",body:"داستان طرح، انتخاب رنگ، اشتباه‌های مسیر و جزئیات محصول را در چند محتوای کوتاه منتشر کن. همه چیز را یک‌جا لو نده؛ هر محتوا باید یک سؤال یا کنجکاوی برای محتوای بعدی باقی بگذارد."},
        {title:"سه قالب محتوای قابل تکرار بساز",body:"یک ریلز توقف‌اسکرول، یک مقایسه قبل و بعد و یک محتوای پاسخ به سؤال آماده کن. در دو ثانیه اول نتیجه یا جذاب‌ترین جزئیات را نشان بده، زیرنویس خوانا اضافه کن و فقط یک اقدام مشخص مثل «لینک را ببین» بخواه."},
        {title:"روز لانچ مسیر خرید را کوتاه نگه دار",body:"لینک مستقیم همان محصول را منتشر کن، نه صفحه‌ای که مشتری مجبور شود دوباره جست‌وجو کند. قیمت، رنگ‌های اصلی، مزیت و زمان ارسال را همان ابتدا بگو و پاسخ سؤال‌های پرتکرار را از قبل آماده داشته باش."},
        {title:"پیام‌ها و سفارش‌ها را با یک ریتم ثابت مدیریت کن",body:"دو یا سه بازه مشخص در روز برای پاسخ‌گویی تعیین کن و سفارش‌های نیازمند توجه را از پنل دنبال کن. اگر مشکلی پیش آمد، قبل از اینکه مشتری پیگیری کند وضعیت واقعی و قدم بعدی را شفاف بگو."},
        {title:"بعد از دریافت محصول، حلقه اعتماد بساز",body:"از مشتری بخواه تجربه و تصویر واقعی‌اش را ثبت کند، اما برای نظر مثبت فشار نیاور. محتوای مشتری با اجازه او می‌تواند اعتماد خریدهای بعدی را بالا ببرد و سؤال‌های واقعی برای بهبود صفحه محصول بدهد."},
        {title:"در پایان ۱۴ روز، داده را به تصمیم تبدیل کن",body:"بازدید، کلیک، افزودن به سبد، خرید، سود و سؤال‌های پرتکرار را مرور کن. فقط یک یا دو تغییر بزرگ برای دوره بعد انتخاب کن—مثلاً تصویر اول یا پیشنهاد قیمت—تا بفهمی کدام اصلاح واقعاً نتیجه ساخته است."}
      ]),
      difficulty:"INTERMEDIATE",video_file_id:null,thumbnail_file_id:files.product.id,attachment_file_id:null,duration_minutes:40,sort_order:5,status:"PUBLISHED",
    },
  ];
  for(const tutorial of tutorials) await upsert("tutorials",tutorial,["seed_key"]);
  await upsert("tutorial_progress",{tutorial_id:sid(1210),user_id:authIds.seller1,completed:true,progress_percent:100,completed_at:days(-20)},["tutorial_id","user_id"]);
  await upsert("tutorial_progress",{tutorial_id:sid(1211),user_id:authIds.seller1,completed:false,progress_percent:60,completed_at:null},["tutorial_id","user_id"]);

  // Tickets with messages and attachment -------------------------------------
  await upsert("tickets",{id:sid(1230),organization_id:sid(2),opened_by_user_id:authIds.seller1,subject:"پیگیری سفارش CH-DEMO-1003",category:"ORDER",priority:"HIGH",status:"WAITING_SUPPORT",reference_type:"ORDER",reference_id:"CH-DEMO-1003",assignee_id:authIds.admin,last_message_at:days(-1),created_at:days(-2)});
  await upsert("ticket_participants",{id:sid(1231),ticket_id:sid(1230),user_id:authIds.seller1,organization_id:sid(2),role:"REQUESTER"});
  await upsert("ticket_participants",{id:sid(1232),ticket_id:sid(1230),user_id:authIds.admin,organization_id:sid(1),role:"ASSIGNEE"});
  await upsert("ticket_messages",{id:sid(1233),ticket_id:sid(1230),sender_id:authIds.seller1,sender_role:"SELLER",body:"این سفارش هنوز وارد تولید نشده؛ لطفاً بررسی کنید.",visibility:"PUBLIC",created_at:days(-2)});
  await upsert("ticket_messages",{id:sid(1234),ticket_id:sid(1230),sender_id:authIds.admin,sender_role:"ADMIN",body:"در حال بررسی با تأمین‌کننده هستیم و همین‌جا خبر می‌دهیم.",visibility:"PUBLIC",created_at:days(-1)});
  await upsert("ticket_messages",{id:sid(1235),ticket_id:sid(1230),sender_id:authIds.admin,sender_role:"ADMIN",body:"یادداشت داخلی: SLA تأمین‌کننده بررسی شود.",visibility:"INTERNAL",created_at:days(-1)});
  await upsert("ticket_attachments",{id:sid(1236),ticket_id:sid(1230),message_id:sid(1233),file_id:files.ticket.id,storage_path:files.ticket.path,file_name:"design-front.png",mime_type:"image/png",size_bytes:1869459,scan_status:"CLEAN",created_at:days(-2)});
  await upsert("ticket_read_states",{ticket_id:sid(1230),user_id:authIds.seller1,last_read_message_id:sid(1233),last_read_at:days(-2),unread_count:1},["ticket_id","user_id"]);
  await upsert("ticket_read_states",{ticket_id:sid(1230),user_id:authIds.admin,last_read_message_id:sid(1234),last_read_at:days(-1),unread_count:0},["ticket_id","user_id"]);

  // Production workflow coverage --------------------------------------------
  await insertIgnore("payment_attempts",{
    id:sid(1300),order_id:sid(900),payment_id:sid(1040),provider:"DEMO",
    provider_attempt_id:"DEMO-ATTEMPT-SUCCESS",idempotency_key:"seed-payment-attempt-success",
    amount:12900000,currency:"IRR",status:"SUCCEEDED",
    request_payload:JSON.stringify({seed:true,method:"gateway"}),
    response_payload:JSON.stringify({seed:true,reference:"PAY-DEMO-0"}),
    completed_at:days(-25),created_at:days(-25),updated_at:days(-25),
  },["idempotency_key"]);
  await insertIgnore("payment_attempts",{
    id:sid(1301),order_id:sid(903),payment_id:sid(1043),provider:"DEMO",
    provider_attempt_id:"DEMO-ATTEMPT-FAILED",idempotency_key:"seed-payment-attempt-failed",
    amount:28900000,currency:"IRR",status:"FAILED",
    request_payload:JSON.stringify({seed:true,method:"gateway"}),
    response_payload:JSON.stringify({seed:true,declined:true}),
    failure_code:"DEMO_DECLINED",failure_message:"تراکنش آزمایشی ناموفق",
    completed_at:days(-3),created_at:days(-3),updated_at:days(-3),
  },["idempotency_key"]);
  await insertIgnore("refunds",{
    id:sid(1302),order_id:sid(900),payment_id:sid(1040),
    requested_by:authIds.buyer1,processed_by:authIds.admin,amount:790000,
    currency:"IRR",reason:"اصلاح هزینه ارسال",status:"SUCCEEDED",
    idempotency_key:"seed-refund-success",provider_ref:"DEMO-REFUND-1001",
    provider_response:JSON.stringify({seed:true}),requested_at:days(-9),
    processed_at:days(-8),updated_at:days(-8),
  },["idempotency_key"]);
  await insertIgnore("order_cancellations",{
    id:sid(1303),order_id:sid(905),requested_by:authIds.buyer2,
    reviewed_by:authIds.admin,reason:"تغییر نظر خریدار",status:"COMPLETED",
    idempotency_key:"seed-cancellation-completed",
    review_message:"لغو و بازگشت وجه تأیید شد.",requested_at:days(-10),
    reviewed_at:days(-10),completed_at:days(-9),updated_at:days(-9),
  },["idempotency_key"]);
  await insertIgnore("return_requests",{
    id:sid(1304),order_item_id:sid(920),buyer_user_id:authIds.buyer1,
    reviewed_by:authIds.admin,reason:"نیاز به تعویض سایز",
    description:"محصول سالم است اما سایز انتخابی مناسب نبود.",status:"RESOLVED",
    idempotency_key:"seed-return-resolved",return_tracking_code:"RET-DEMO-1001",
    resolution:"تعویض سایز انجام شد.",requested_at:days(-8),
    reviewed_at:days(-8),received_at:days(-6),resolved_at:days(-5),
    updated_at:days(-5),
  },["idempotency_key"]);
  await insertIgnore("disputes",{
    id:sid(1305),order_id:sid(902),order_item_id:sid(922),
    opened_by:authIds.buyer1,assigned_to:authIds.admin,
    reason:"پیگیری وضعیت ارسال",
    description:"کد رهگیری ثبت شده اما آخرین وضعیت مرسوله نیاز به بررسی دارد.",
    status:"UNDER_REVIEW",idempotency_key:"seed-dispute-open",
    opened_at:days(-2),updated_at:days(-1),
  },["idempotency_key"]);
  await insertIgnore("reprints",{
    id:sid(1306),order_item_id:sid(920),original_fulfilment_id:sid(940),
    requested_by:authIds.admin,approved_by:authIds.admin,
    reason:"نمونه‌ی کنترل کیفیت برای سناریوی آزمایشی",status:"APPROVED",
    idempotency_key:"seed-reprint-approved",requested_at:days(-4),
    approved_at:days(-3),updated_at:days(-3),
  },["idempotency_key"]);
  await insertIgnore("supplier_variant_availability_events",{
    id:sid(1307),supplier_offer_variant_id:offerVariant(sid(400),sid(251)),
    from_status:"LOW_STOCK",to_status:"AVAILABLE",changed_by:authIds.supplier1,
    reason:"موجودی آزمایشی شارژ شد",snapshot:JSON.stringify({seed:true,quantity:50}),
    created_at:days(-2),
  });
  await upsert("store_domains",{
    id:sid(1308),store_id:sid(50),hostname:"abr-studio.chapli.local",
    domain_type:"SUBDOMAIN",status:"ACTIVE",verification_token:"seed-abr-studio-domain",
    verification_records:JSON.stringify([{type:"CNAME",name:"abr-studio",value:"shops.chapli.local"}]),
    certificate_status:"ACTIVE",verified_at:days(-30),activated_at:days(-30),
    last_checked_at:days(-1),last_error:null,created_at:days(-30),updated_at:days(-1),
  });
  for(const preference of [
    {id:sid(1310),user_id:authIds.buyer1,event_type:"ORDER_STATUS",channel:"IN_APP",enabled:true},
    {id:sid(1311),user_id:authIds.buyer1,event_type:"ORDER_STATUS",channel:"SMS",enabled:true},
    {id:sid(1312),user_id:authIds.seller1,event_type:"PAYOUT_STATUS",channel:"IN_APP",enabled:true},
    {id:sid(1313),user_id:authIds.supplier1,event_type:"FULFILMENT_ASSIGNED",channel:"SMS",enabled:true},
  ]) await upsert("notification_preferences",preference,["user_id","event_type","channel"]);
  await upsert("notification_outbox",{
    id:sid(1314),event_type:"ORDER_STATUS",recipient_user_id:authIds.buyer1,
    recipient_phone:"09121234567",template_id:null,
    payload:JSON.stringify({seed:true,orderNumber:"CH-DEMO-1003",status:"SENT"}),
    idempotency_key:"seed-notification-order-sent",status:"SENT",attempts:1,
    available_at:days(-2),sent_at:days(-2),last_error:null,
    created_at:days(-2),updated_at:days(-2),
  },["idempotency_key"]);
  await insertIgnore("notification_deliveries",{
    id:sid(1315),outbox_id:sid(1314),channel:"SMS",provider:"DEMO",
    provider_message_id:"DEMO-SMS-1001",attempt_number:1,status:"DELIVERED",
    provider_response:JSON.stringify({seed:true}),attempted_at:days(-2),
    delivered_at:days(-2),
  },["outbox_id","channel","attempt_number"]);
  await upsert("webhook_events",{
    id:sid(1316),provider:"DEMO",provider_event_id:"DEMO-WEBHOOK-1001",
    event_type:"payment.captured",signature_valid:true,status:"PROCESSED",
    payload:JSON.stringify({seed:true,paymentId:"PAY-DEMO-0"}),
    attempts:1,last_error:null,received_at:days(-25),processed_at:days(-25),
    updated_at:days(-25),
  },["provider","provider_event_id"]);
  await q(`
    insert into public.analytics_events(
      user_id,event_name,occurred_at,consent_state,properties,context,release_version
    )
    select $1,'product_view',$2,'ANALYTICS',
      '{"seed":true,"seedKey":"product-view-600","productId":"00000000-0000-4000-8000-000000000258"}'::jsonb,
      '{"surface":"storefront","device":"mobile"}'::jsonb,'seed-1.0.0'
    where not exists(
      select 1 from public.analytics_events
      where properties->>'seedKey'='product-view-600'
    )
  `,[authIds.buyer1,days(-1)]);
  await upsert("app_releases",{
    id:sid(1317),version:"seed-1.0.0",commit_sha:"seed-development-snapshot",
    migration_version:"202607300003",environment:"TEST",status:"ACTIVE",
    metadata:JSON.stringify({seed:true,notes:"Idempotent development release"}),
    deployed_by:authIds.admin,started_at:days(-1),completed_at:days(-1),
  },["environment","version"]);

  await q("commit");
}catch(error){
  await q("rollback");
  throw error;
}

// Upload one real placeholder object per file path after the relational
// transaction succeeds. Upsert makes this safe to repeat.
const placeholder=await fs.readFile("public/images/product-placeholder.png");
const checksum=createHash("sha256").update(placeholder).digest("hex");
const seedStorageFiles=Object.values({
  product:{bucket:"product-images",path:"demo/product-placeholder.png"},
  logo:{bucket:"product-images",path:"demo/store-logo.png"},
  banner:{bucket:"product-images",path:"demo/store-banner.png"},
  rawImage:{bucket:"raw-product-assets",path:"demo/raw-product.png"},
  background:{bucket:"raw-product-assets",path:"demo/background.png"},
  overlay:{bucket:"raw-product-assets",path:"demo/overlay.png"},
  mockup:{bucket:"variant-mockups",path:"demo/mockup.png"},
  design:{bucket:"design-files",path:`${authIds.seller1}/demo/design.png`},
  printable:{bucket:"printable-exports",path:`${authIds.seller1}/demo/printable.png`},
  ai:{bucket:"ai-generated",path:`${authIds.seller2}/demo/ai.png`},
  receipt:{bucket:"payout-receipts",path:`${authIds.admin}/demo/receipt.png`},
  ticket:{bucket:"ticket-attachments",path:`${authIds.seller1}/demo/ticket.png`},
});
const existingStorageRows=await q(
  "select bucket_id,name from storage.objects where bucket_id=any($1::text[]) and name=any($2::text[])",
  [[...new Set(seedStorageFiles.map(file=>file.bucket))],seedStorageFiles.map(file=>file.path)],
);
const existingStorage=new Set(existingStorageRows.rows.map(row=>`${row.bucket_id}:${row.name}`));
for(const file of seedStorageFiles){
  if(existingStorage.has(`${file.bucket}:${file.path}`))continue;
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    const {error}=await supabase.storage.from(file.bucket).upload(file.path,placeholder,{
      contentType:"image/png",upsert:true,cacheControl:"3600",
    });
    if(!error){lastError=null;break}
    lastError=error;
    await new Promise(resolve=>setTimeout(resolve,attempt*750));
  }
  if(lastError) throw lastError;
}
await q(`update public.storage_files set checksum_sha256=$1 where metadata->>'seed'='true'`,[checksum]);
await db.end();

console.log(JSON.stringify({
  authUsers:accounts.length,
  stores:3,
  suppliers:2,
  rawProducts:5,
  sellerProducts:8,
  orders:6,
  payouts:2,
  tickets:1,
  workflowExceptions:5,
  notificationDeliveries:1,
  releases:1,
  storageObjects:12,
  demoPassword:password,
}));
