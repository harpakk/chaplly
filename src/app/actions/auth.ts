"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getUserByEmail, registerSeller, storeSlugExists, updateLastLogin } from "@/lib/database";
import { destroySession, requireSeller } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { clearMarketplaceMemoryCache } from "@/lib/catalog-data";
import { persistUserAttribution } from "@/lib/attribution";

export type AuthState = { message?: string; errors?: Record<string,string[]|undefined> };

const loginSchema=z.object({email:z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),password:z.string().min(1,"رمز عبور را وارد کن.")});
const quickRegisterSchema=z.object({email:z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),password:z.string().min(8,"رمز عبور باید حداقل ۸ کاراکتر باشد.")});
const optional=(max=300)=>z.string().trim().max(max).optional().default("");
const registerSchema=z.object({
  firstName:z.string().trim().min(2,"نام باید حداقل ۲ حرف باشد.").max(100),
  lastName:z.string().trim().min(2,"نام خانوادگی باید حداقل ۲ حرف باشد.").max(100),
  phone:z.string().trim().regex(/^(\+98|0)?9\d{9}$/,"شماره موبایل معتبر نیست."),
  email:z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
  password:z.string().min(8,"رمز عبور باید حداقل ۸ کاراکتر باشد.").regex(/[A-Za-z]/,"رمز باید حرف انگلیسی داشته باشد.").regex(/[0-9]/,"رمز باید عدد داشته باشد."),
  confirmPassword:z.string(),
  sellerType:z.string().trim().min(1,"نوع فعالیت را انتخاب کن.").max(40),
  experienceLevel:optional(40),instagramHandle:optional(100),websiteUrl:optional(),audienceSize:optional(40),monthlyViews:optional(40),sellerGoal:optional(1000),
  storeName:z.string().trim().min(2,"نام فروشگاه باید حداقل ۲ حرف باشد.").max(160),
  storeSlug:z.union([z.literal(""),z.string().trim().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"آدرس باید فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد و فاصله نداشته باشد.")]).optional().default(""),
  storeDescription:z.string().trim().min(10,"توضیح فروشگاه باید حداقل ۱۰ حرف باشد.").max(1000),
  primaryCategory:z.string().trim().min(1,"دسته اصلی را انتخاب کن.").max(40),
  brandTone:optional(40),
  supportEmail:z.union([z.literal(""),z.string().trim().email("ایمیل پشتیبانی معتبر نیست.")]).optional().default(""),
  supportPhone:optional(32),socialUrl:optional(),brandColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#ef5b4c"),
  terms:z.literal("on",{message:"پذیرش قوانین برای ساخت حساب لازم است."}),
}).refine((data)=>data.password===data.confirmPassword,{message:"تکرار رمز عبور یکسان نیست.",path:["confirmPassword"]});

function slugifyStore(value:string){
  const normalized=value.normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);
  return normalized||`shop-${crypto.randomUUID().slice(0,8)}`;
}

async function persistSignupStoreMedia(userId:string,formData:FormData){
  const db=createSupabaseAdmin();
  const {data:store}=await db.from("stores").select("id,organization_id").eq("owner_user_id",userId).maybeSingle();
  if(!store)return;
  const updates:{logo_file_id?:string;banner_file_id?:string}={};
  await Promise.all(([
    ["storeLogo","STORE_LOGO","logo_file_id"],
    ["storeBanner","STORE_BANNER","banner_file_id"],
  ] as const).map(async entry=>{
    const [field,kind,column]=entry;
    const file=formData.get(field);
    if(!(file instanceof File)||!file.size||file.size>10*1024*1024)return;
    const path=`${userId}/stores/${store.id}/${randomUUID()}-${file.name.replace(/[^\w.-]+/g,"-")}`;
    const {error:uploadError}=await db.storage.from("product-images").upload(path,file,{upsert:false});
    if(uploadError)throw uploadError;
    const {data:stored,error}=await db.from("storage_files").insert({
      owner_user_id:userId,owner_organization_id:store.organization_id,bucket:"product-images",path,kind,
      original_name:file.name,mime_type:file.type||"image/webp",size_bytes:file.size,state:"READY",
    }).select("id").single();
    if(error)throw error;
    if(column==="logo_file_id")updates.logo_file_id=stored.id;else updates.banner_file_id=stored.id;
  }));
  if(Object.keys(updates).length){
    const {error}=await db.from("stores").update(updates).eq("id",store.id);
    if(error)throw error;
    clearMarketplaceMemoryCache();
    revalidatePath("/");
    revalidateTag("marketplace-home");
  }
}

export async function loginAction(_:AuthState,formData:FormData):Promise<AuthState>{
  const parsed=loginSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)return{errors:parsed.error.flatten().fieldErrors};
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password});
  if(error||!data.user)return{message:"ایمیل یا رمز عبور درست نیست."};
  const user=await getUserByEmail(parsed.data.email,true);
  const valid=user&&user.status==="ACTIVE";
  const isSeller=user?.memberships.some((membership)=>membership.status==="ACTIVE"&&membership.organization.type==="SELLER");
  if(!valid||!isSeller){await supabase.auth.signOut();return{message:"این حساب دسترسی فروشنده ندارد."};}
  await updateLastLogin(user.id);redirect("/seller/dashboard");
}

export async function registerAction(_:AuthState,formData:FormData):Promise<AuthState>{
  const parsed=registerSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)return{errors:parsed.error.flatten().fieldErrors};
  try{
    const exists=await getUserByEmail(parsed.data.email);if(exists)return{errors:{email:["برای این ایمیل قبلاً حساب ساخته شده."]}};
    const baseSlug=slugifyStore(parsed.data.storeSlug||parsed.data.storeName);let slug=baseSlug;let suffix=1;while(await storeSlugExists(slug))slug=`${baseSlug}-${suffix++}`;
    const user=await registerSeller({...parsed.data,password:parsed.data.password,slug});
    await persistUserAttribution(user.id).catch(error=>console.error("Seller attribution failed",error));
    await persistSignupStoreMedia(user.id,formData);
    const supabase=await createSupabaseServerClient();
    const {error:signInError}=await supabase.auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password});
    if(signInError)throw signInError;
    await updateLastLogin(user.id);redirect("/seller/dashboard");
  }catch(error){
    if(typeof error==="object"&&error!==null&&"digest" in error&&String(error.digest).startsWith("NEXT_REDIRECT"))throw error;
    if(error instanceof Error&&error.message==="EMAIL_EXISTS")return{errors:{email:["برای این ایمیل قبلاً حساب ساخته شده."]}};
    if(error instanceof Error&&error.message==="SLUG_EXISTS")return{errors:{storeSlug:["این آدرس همین الان گرفته شد؛ یک آدرس دیگه امتحان کن."]}};
    const code=typeof error==="object"&&error!==null&&"code" in error?String(error.code):"UNKNOWN";
    console.error("Seller registration failed",{code,message:error instanceof Error?error.message:"Unknown error"});
    return{message:`ساخت حساب انجام نشد. خطای پایگاه‌داده: ${code}. اطلاعاتت نگه داشته شده؛ دوباره تلاش کن یا با پشتیبانی تماس بگیر.`};
  }
}

export async function quickSellerRegisterAction(_:AuthState,formData:FormData):Promise<AuthState>{
 const parsed=quickRegisterSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)return{errors:parsed.error.flatten().fieldErrors};
 try{
  const exists=await getUserByEmail(parsed.data.email);if(exists)return{errors:{email:["برای این ایمیل قبلاً حساب ساخته شده."]}};
  const emailName=parsed.data.email.split("@")[0]||"shop";
  const baseSlug=slugifyStore(emailName);let slug=baseSlug;let suffix=1;while(await storeSlugExists(slug))slug=`${baseSlug}-${suffix++}`;
  const user=await registerSeller({email:parsed.data.email,password:parsed.data.password,firstName:"",lastName:"",phone:"",storeName:"فروشگاه من",slug,sellerType:"",experienceLevel:"",instagramHandle:"",websiteUrl:"",audienceSize:"",monthlyViews:"",sellerGoal:"",storeDescription:"",primaryCategory:"",brandTone:"",supportEmail:"",supportPhone:"",socialUrl:"",brandColor:"#ef5b4c"});
  await persistUserAttribution(user.id).catch(error=>console.error("Seller attribution failed",error));
  const supabase=await createSupabaseServerClient();
  const {error}=await supabase.auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password});if(error)throw error;
  await updateLastLogin(user.id);redirect("/seller/onboarding");
 }catch(error){
  if(typeof error==="object"&&error!==null&&"digest" in error&&String(error.digest).startsWith("NEXT_REDIRECT"))throw error;
  if(error instanceof Error&&error.message==="EMAIL_EXISTS")return{errors:{email:["برای این ایمیل قبلاً حساب ساخته شده."]}};
  console.error("Quick seller registration failed",error);return{message:"ساخت حساب انجام نشد؛ دوباره تلاش کن یا وارد حساب قبلی شو."};
 }
}

export async function completeSellerOnboardingAction(formData:FormData){
 const context=await requireSeller();
 const store=context.membership.organization.stores[0];if(!store)redirect("/seller/dashboard");
 const clean=(name:string,max=500)=>String(formData.get(name)||"").trim().slice(0,max);
 const db=createSupabaseAdmin();
 const firstName=clean("firstName",100),lastName=clean("lastName",100),phone=clean("phone",32);
 const storeName=clean("storeName",160),description=clean("storeDescription",1000),sellerType=clean("sellerType",40),experienceLevel=clean("experienceLevel",40),instagramHandle=clean("instagramHandle",100),primaryCategory=clean("primaryCategory",40),brandTone=clean("brandTone",40),brandColor=clean("brandColor",16);
 const profileUpdate={first_name:firstName||undefined,last_name:lastName||undefined,phone:phone||undefined};
 if(firstName||lastName||phone){const{error}=await db.from("profiles").update(profileUpdate).eq("id",context.user.id);if(error)throw error;}
 const storeUpdate={name:storeName||undefined,description:description||undefined,primary_category:primaryCategory||undefined,brand_tone:brandTone||undefined,brand_color:/^#[0-9a-f]{6}$/i.test(brandColor)?brandColor:undefined};
 if(storeName||description||primaryCategory||brandTone||brandColor){const{error}=await db.from("stores").update(storeUpdate).eq("id",store.id);if(error)throw error;}
 const sellerUpdate={seller_type:sellerType||undefined,experience_level:experienceLevel||undefined,instagram_handle:instagramHandle||undefined};
 if(sellerType||experienceLevel||instagramHandle){const{error}=await db.from("seller_profiles").update(sellerUpdate).eq("organization_id",context.membership.organization.id);if(error)throw error;}
 await db.rpc("service_save_seller_onboarding_answers",{p_user_id:context.user.id,p_answers:{firstName,lastName,phone,storeName,storeDescription:description,sellerType,experienceLevel,instagramHandle,primaryCategory,brandTone,brandColor}});
 clearMarketplaceMemoryCache();revalidatePath("/");revalidatePath("/seller/dashboard");redirect("/seller/dashboard");
}

export async function logoutAction(){await destroySession();redirect("/seller")}
