import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_COOKIE = "chapli-admin-access";
const ADMIN_TTL_SECONDS = 24 * 60 * 60;

export type AdminAccessMode = "temporary" | "profile";

export function getAdminAccessMode(): AdminAccessMode {
  if (process.env.DEPLOYMENT_ENV === "production") return "profile";
  return process.env.ADMIN_ACCESS_MODE === "profile" ? "profile" : "temporary";
}

function getTemporaryAccessCode() {
  return process.env.ADMIN_STATIC_PASSWORD || "13791622";
}

function getCookieSecret() {
  const configured = process.env.ADMIN_COOKIE_SECRET;
  if (configured) return configured;
  if (process.env.DEPLOYMENT_ENV === "production")
    throw new Error("ADMIN_COOKIE_SECRET is required in production");
  return getTemporaryAccessCode();
}

function sign(value: string) {
  return createHmac("sha256", getCookieSecret())
    .update(value)
    .digest("base64url");
}

async function grantTemporaryAccess(userId: string) {
  const expires = Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ||
      process.env.VERCEL === "1",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  });
}

async function hasValidGrant(userId: string) {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const parts = value.split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== userId ||
    Number(parts[1]) <= Math.floor(Date.now() / 1000)
  )
    return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(parts[2]);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

async function isActiveSeller(userId: string) {
  const profile = await getUserById(userId, true);
  return Boolean(
    profile?.status === "ACTIVE" &&
      profile.memberships.some(
        (item) =>
          item.status === "ACTIVE" && item.organization.type === "SELLER",
      ),
  );
}

async function hasActiveAdminProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return !error && Boolean(data);
}

async function satisfiesMfaPolicy() {
  if (process.env.ADMIN_REQUIRE_MFA !== "true") return true;
  const supabase = await createSupabaseServerClient();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data.currentLevel === "aal2";
}

async function authorizeSignedInUser(userId: string, accessCode: string) {
  if (getAdminAccessMode() === "profile")
    return (await hasActiveAdminProfile(userId)) && (await satisfiesMfaPolicy());

  if (accessCode !== getTemporaryAccessCode()) return false;
  if (!(await isActiveSeller(userId))) return false;
  await grantTemporaryAccess(userId);
  return true;
}

export async function signInAdmin(
  email: string,
  password: string,
  accessCode: string,
) {
  const supabase = await createSupabaseServerClient();
  const claimsResult = await supabase.auth.getClaims();
  let userId =
    typeof claimsResult.data?.claims?.sub === "string"
      ? claimsResult.data.claims.sub
      : null;
  if (!userId) {
    if (!email || !password) return false;
    const result = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (result.error || !result.data.user) return false;
    userId = result.data.user.id;
  }
  try {
    return await authorizeSignedInUser(userId, accessCode);
  } catch (error) {
    console.error("Admin authorization failed", error);
    return false;
  }
}

export async function isAdminAuthenticated() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) return false;
  if (getAdminAccessMode() === "profile")
    return (await hasActiveAdminProfile(userId)) && (await satisfiesMfaPolicy());
  return hasValidGrant(userId);
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) redirect("/admin/login");
  const authorized =
    getAdminAccessMode() === "profile"
      ? (await hasActiveAdminProfile(userId)) && (await satisfiesMfaPolicy())
      : await hasValidGrant(userId);
  if (!authorized) redirect("/admin/login");
  return { id: userId };
}

export async function destroyAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
