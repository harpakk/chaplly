import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type Store = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  defaultLocale: string;
  defaultCurrency: string;
};
export type Organization = {
  id: string;
  type: "PLATFORM" | "SELLER" | "SUPPLIER";
  legalName: string;
  displayName: string;
  slug: string;
  stores: Store[];
};
export type Membership = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  status: "INVITED" | "ACTIVE" | "REVOKED";
  organization: Organization;
};
export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "PENDING" | "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "CLOSED";
  locale: string;
  primaryRole: "BUYER" | "SELLER" | "SUPPLIER" | "ADMIN";
  memberships: Membership[];
};

const mapStore = (row: Record<string, unknown>): Store => ({
  id: String(row.id),
  organizationId: String(row.organization_id),
  name: String(row.name),
  slug: String(row.slug),
  status: String(row.status),
  defaultLocale: String(row.default_locale),
  defaultCurrency: String(row.default_currency),
});

export async function getUserByEmail(email: string, withMemberships = false) {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("profiles")
    .select("id,email,first_name,last_name,state,locale,primary_role")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? hydrateUser(data, withMemberships) : null;
}

export async function getUserById(id: string, withMemberships = false) {
  const db = createSupabaseAdmin();
  if (withMemberships) {
    const { data, error } = await db
      .from("profiles")
      .select(
        "id,email,first_name,last_name,state,locale,primary_role,memberships!memberships_user_id_fkey(id,user_id,organization_id,role,status,organizations(id,type,legal_name,display_name,slug,stores(id,organization_id,name,slug,status,default_locale,default_currency)))",
      )
      .eq("id", id)
      .eq("memberships.status", "ACTIVE")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const user: User = {
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      status: data.state as User["status"],
      locale: data.locale,
      primaryRole: data.primary_role as User["primaryRole"],
      memberships: (data.memberships || []).flatMap((row) => {
        const raw = Array.isArray(row.organizations)
          ? row.organizations[0]
          : row.organizations;
        if (!raw) return [];
        return [{
          id: row.id,
          userId: row.user_id,
          organizationId: row.organization_id,
          role: row.role,
          status: row.status as Membership["status"],
          organization: {
            id: raw.id,
            type: raw.type as Organization["type"],
            legalName: raw.legal_name,
            displayName: raw.display_name,
            slug: raw.slug,
            stores: (raw.stores || []).map((item: Record<string, unknown>) =>
              mapStore(item),
            ),
          },
        }];
      }),
    };
    return user;
  }
  const { data, error } = await db
    .from("profiles")
    .select("id,email,first_name,last_name,state,locale,primary_role")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? hydrateUser(data, false) : null;
}

async function hydrateUser(
  data: Record<string, unknown>,
  withMemberships: boolean,
): Promise<User> {
  const user: User = {
    id: String(data.id),
    email: String(data.email),
    firstName: String(data.first_name),
    lastName: String(data.last_name),
    status: data.state as User["status"],
    locale: String(data.locale),
    primaryRole: data.primary_role as User["primaryRole"],
    memberships: [],
  };
  if (!withMemberships) return user;
  const db = createSupabaseAdmin();
  const { data: rows, error } = await db
    .from("memberships")
    .select(
      "id,user_id,organization_id,role,status,organizations(id,type,legal_name,display_name,slug,stores(id,organization_id,name,slug,status,default_locale,default_currency))",
    )
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");
  if (error) throw error;
  user.memberships = (rows || []).map((row) => {
    const raw = (Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations) as unknown as Record<string, unknown>;
    const stores: Record<string, unknown>[] = Array.isArray(raw.stores)
      ? (raw.stores as Record<string, unknown>[])
      : [];
    return {
      id: String(row.id),
      userId: String(row.user_id),
      organizationId: String(row.organization_id),
      role: String(row.role),
      status: row.status as Membership["status"],
      organization: {
        id: String(raw.id),
        type: raw.type as Organization["type"],
        legalName: String(raw.legal_name),
        displayName: String(raw.display_name),
        slug: String(raw.slug),
        stores: stores.map((item) => mapStore(item)),
      },
    };
  });
  return user;
}

export async function updateLastLogin(userId: string) {
  const { error } = await createSupabaseAdmin()
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function storeSlugExists(slug: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

type SellerInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  storeName: string;
  slug: string;
  sellerType: string;
  experienceLevel: string;
  instagramHandle: string;
  websiteUrl: string;
  audienceSize: string;
  monthlyViews: string;
  sellerGoal: string;
  storeDescription: string;
  primaryCategory: string;
  brandTone: string;
  supportEmail: string;
  supportPhone: string;
  socialUrl: string;
  brandColor: string;
};
const audienceValue = (value: string) =>
  ({
    UNDER_10K: 5000,
    "10K_100K": 50000,
    "100K_1M": 500000,
    OVER_1M: 1500000,
    UNDER_100K: 50000,
    "1M_10M": 3000000,
    OVER_10M: 12000000,
  })[value] ?? 0;

async function createRegistrationUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "SELLER" | "SUPPLIER";
}) {
  const db = createSupabaseAdmin();
  const create = () =>
    db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        role: input.role,
      },
    });
  const first = await create();
  if (first.data.user) return first.data.user.id;
  const retryable =
    Number(first.error?.status || 0) === 0 ||
    first.error?.name === "AuthRetryableFetchError";
  if (!retryable) {
    if (first.error?.message.toLowerCase().includes("already"))
      throw new Error("EMAIL_EXISTS");
    throw first.error || new Error("AUTH_CREATE_FAILED");
  }

  // A timed-out Auth response may still have committed. The profile trigger is
  // the safe recovery marker; otherwise retry the create once.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const recovered = await db
    .from("profiles")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();
  if (recovered.data?.id) return recovered.data.id;
  const second = await create();
  if (second.data.user) return second.data.user.id;
  throw second.error || first.error || new Error("AUTH_CREATE_FAILED");
}

export async function registerSeller(input: SellerInput) {
  const db = createSupabaseAdmin();
  const userId = await createRegistrationUser({ ...input, role: "SELLER" });
  const payload = {
    ...input,
    audienceSize: audienceValue(input.audienceSize),
    monthlyViews: audienceValue(input.monthlyViews),
    supportEmail: input.supportEmail || input.email,
    supportPhone: input.supportPhone || input.phone,
  };
  const { data, error } = await db.rpc("provision_seller", {
    p_user_id: userId,
    p_payload: payload,
  });
  if (error) {
    await db.auth.admin.deleteUser(userId);
    if (error.code === "23505")
      throw new Error(
        error.message.includes("stores_slug") ? "SLUG_EXISTS" : "EMAIL_EXISTS",
      );
    throw error;
  }
  const onboardingAnswers = {
    sellerType: input.sellerType,
    experienceLevel: input.experienceLevel,
    instagramHandle: input.instagramHandle,
    websiteUrl: input.websiteUrl,
    audienceSize: input.audienceSize,
    monthlyViews: input.monthlyViews,
    storeName: input.storeName,
    storeDescription: input.storeDescription,
    primaryCategory: input.primaryCategory,
    brandTone: input.brandTone,
    brandColor: input.brandColor,
  };
  const { error: answersError } = await db.rpc("service_save_seller_onboarding_answers", {
    p_user_id: userId,
    p_answers: onboardingAnswers,
  });
  if (answersError) throw answersError;
  return { id: userId, result: data };
}

type SupplierInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  legalName: string;
  displayName: string;
  nationalId: string;
  registrationNumber: string;
  city: string;
  address: string;
  postalCode: string;
  capacityPerDay: number;
  leadTimeDays: number;
  methodIds: string[];
  categoryIds: string[];
  iban: string;
  cardNumber: string;
  website: string;
};
export async function registerSupplier(input: SupplierInput) {
  const db = createSupabaseAdmin();
  const userId = await createRegistrationUser({ ...input, role: "SUPPLIER" });
  const { data, error } = await db.rpc("provision_supplier", {
    p_user_id: userId,
    p_payload: input,
  });
  if (error) {
    await db.auth.admin.deleteUser(userId);
    throw error;
  }
  return { id: userId, result: data };
}
