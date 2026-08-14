import type { Database as GeneratedDatabase, Json } from "@/types/database.generated";

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type AdditionalTables = {
  coupons: Table<{
    id: string; code: string; created_by: string; owner_organization_id: string | null;
    discount_type: string; discount_value: number; applies_to: string; all_stores: boolean;
    expires_at: string; max_usage: number; usage_count: number; status: string;
    created_at: string; updated_at: string;
  }, "code" | "created_by" | "discount_type" | "discount_value" | "applies_to" | "expires_at" | "max_usage">;
  coupon_stores: Table<{ coupon_id: string; store_id: string }, "coupon_id" | "store_id">;
  coupon_categories: Table<{ coupon_id: string; category_id: string }, "coupon_id" | "category_id">;
  coupon_redemptions: Table<{
    id: string; coupon_id: string; order_id: string; buyer_user_id: string | null;
    discount_amount: number; redeemed_at: string;
  }, "coupon_id" | "order_id" | "discount_amount">;
  sms_event_configs: Table<{
    event_type: string; name: string; recipient_role: string; description: string;
    pattern_id: number | null; variable_keys: string[]; enabled: boolean;
    is_required_event: boolean; created_at: string; updated_at: string;
  }, "event_type" | "name" | "recipient_role">;
  support_ai_settings: Table<{
    id: string; model: string; system_prompt: string; updated_at: string;
  }, "system_prompt">;
  support_ai_conversations: Table<{
    id: string; user_id: string; user_role: string; created_at: string; updated_at: string;
  }, "user_id" | "user_role">;
  support_ai_messages: Table<{
    id: string; conversation_id: string; user_id: string; role: string; body: string; created_at: string;
  }, "conversation_id" | "user_id" | "role" | "body">;
  ticket_ai_drafts: Table<{
    ticket_id: string; draft: string; source_message_at: string | null; created_at: string; updated_at: string;
  }, "ticket_id" | "draft">;
  buyer_wallets: Table<{
    user_id: string; balance: number; currency: string; updated_at: string;
  }, "user_id">;
  buyer_wallet_transactions: Table<{
    id: string; user_id: string; order_id: string | null; refund_id: string | null;
    direction: string; amount: number; description: string; idempotency_key: string; created_at: string;
  }, "user_id" | "direction" | "amount" | "description" | "idempotency_key">;
  buyer_refund_preferences: Table<{
    user_id: string; destination: string; card_number: string | null; updated_at: string;
  }, "user_id">;
  woocommerce_connections: Table<{
    id: string; organization_id: string; store_id: string; site_url: string;
    consumer_key_encrypted: string; consumer_secret_encrypted: string; webhook_secret_encrypted: string;
    webhook_id: number | null; status: string; price_divisor: number; last_error: string | null;
    last_verified_at: string | null; created_at: string; updated_at: string;
  }, "organization_id" | "store_id" | "site_url" | "consumer_key_encrypted" | "consumer_secret_encrypted" | "webhook_secret_encrypted">;
  woocommerce_product_links: Table<{
    id: string; connection_id: string; seller_product_id: string; woo_product_id: number;
    status: string; last_error: string | null; synced_at: string;
  }, "connection_id" | "seller_product_id" | "woo_product_id">;
  woocommerce_variant_links: Table<{
    id: string; product_link_id: string; seller_product_variant_id: string; woo_variation_id: number; synced_at: string;
  }, "product_link_id" | "seller_product_variant_id" | "woo_variation_id">;
  woocommerce_webhook_events: Table<{
    id: string; connection_id: string; delivery_id: string; topic: string | null; signature: string | null;
    payload: Json; status: string; error_message: string | null; received_at: string; processed_at: string | null;
  }, "connection_id" | "delivery_id" | "payload">;
  woocommerce_order_imports: Table<{
    id: string; connection_id: string; organization_id: string; external_order_id: number; external_order_number: string;
    status: string; customer_snapshot: Json; shipping_address_snapshot: Json; required_amount: number;
    funded_amount: number; platform_order_ids: string[]; raw_payload: Json; imported_at: string;
    converted_at: string | null; updated_at: string;
  }, "connection_id" | "organization_id" | "external_order_id" | "external_order_number">;
  woocommerce_order_import_items: Omit<Table<{
    id: string; import_id: string; external_product_id: number; external_variation_id: number | null;
    seller_product_variant_id: string; quantity: number; unit_cost: number; address_key: string; item_snapshot: Json;
  }, "import_id" | "external_product_id" | "seller_product_variant_id" | "quantity" | "unit_cost">, "Relationships"> & {
    Relationships: [{ foreignKeyName: "woocommerce_order_import_items_import_id_fkey"; columns: ["import_id"]; isOneToOne: false; referencedRelation: "woocommerce_order_imports"; referencedColumns: ["id"] }];
  };
  woocommerce_channel_accounts: Table<{
    organization_id: string; balance: number; currency: string; updated_at: string;
  }, "organization_id">;
  woocommerce_channel_transactions: Table<{
    id: string; organization_id: string; import_id: string | null; direction: string; amount: number;
    source: string; reference: string | null; idempotency_key: string; created_at: string;
  }, "organization_id" | "direction" | "amount" | "source" | "idempotency_key">;
  woocommerce_funding_payments: Table<{
    id: string; import_id: string; organization_id: string; authority: string | null; amount: number; status: string;
    ref_id: string | null; response_payload: Json; idempotency_key: string; created_at: string; completed_at: string | null;
  }, "import_id" | "organization_id" | "amount" | "idempotency_key">;
};

type AdditionalFunctions = {
  service_quote_coupon: { Args: { p_code: string; p_items: Json }; Returns: Json };
  service_apply_coupon_to_order: { Args: { p_order_id: string; p_code: string; p_buyer_user_id: string | null }; Returns: number };
  service_save_seller_onboarding_answers: { Args: { p_user_id: string; p_answers: Json }; Returns: undefined };
  create_support_ai_user_message: {
    Args: { p_user_id: string; p_user_role: string; p_conversation_id: string | null; p_body: string };
    Returns: { message_id: string; conversation_id: string; remaining: number }[];
  };
  apply_buyer_wallet_to_order: { Args: { p_order_id: string }; Returns: number };
  buyer_confirm_order_received: { Args: Record<string, unknown>; Returns: unknown };
  request_partial_payout: { Args: Record<string, unknown>; Returns: unknown };
  service_apply_woocommerce_earnings: { Args: { p_import_id: string }; Returns: number };
  service_convert_woocommerce_import: { Args: { p_import_id: string; p_buyer_user_id: string }; Returns: string[] };
  service_credit_woocommerce_funding: { Args: { p_authority: string; p_ref_id: string; p_response: Json }; Returns: string };
  service_finalize_order_cancellation: { Args: Record<string, unknown>; Returns: unknown };
  service_guest_checkout_create_pending_order: { Args: { p_idempotency_key: string; p_address: Json; p_items: Json }; Returns: string };
  service_complete_buyer_bank_refund: { Args: Record<string, unknown>; Returns: unknown };
  set_buyer_refund_preference: { Args: { p_destination: string; p_card_number: string | null }; Returns: unknown };
};

type OrderState = GeneratedDatabase["public"]["Enums"]["order_state"] | "PENDING";
type GeneratedOrders = GeneratedDatabase["public"]["Tables"]["orders"];
type AttributionFields = {
  referral_code: string | null;
  acquisition_source: string | null;
  attribution_landing_path: string | null;
};
type Orders = Omit<GeneratedOrders, "Row" | "Insert" | "Update"> & {
  Row: Omit<GeneratedOrders["Row"], "status"> & AttributionFields & { status: OrderState };
  Insert: Omit<GeneratedOrders["Insert"], "status"> & Partial<AttributionFields> & { status?: OrderState };
  Update: Omit<GeneratedOrders["Update"], "status"> & Partial<AttributionFields> & { status?: OrderState };
};
type GeneratedProfiles = GeneratedDatabase["public"]["Tables"]["profiles"];
type ProfileAttributionFields = AttributionFields & { attributed_at: string | null };
type Profiles = Omit<GeneratedProfiles, "Row" | "Insert" | "Update"> & {
  Row: GeneratedProfiles["Row"] & ProfileAttributionFields;
  Insert: GeneratedProfiles["Insert"] & Partial<ProfileAttributionFields>;
  Update: GeneratedProfiles["Update"] & Partial<ProfileAttributionFields>;
};
type GeneratedSellerProfiles = GeneratedDatabase["public"]["Tables"]["seller_profiles"];
type SellerProfiles = Omit<GeneratedSellerProfiles, "Row" | "Insert" | "Update"> & {
  Row: GeneratedSellerProfiles["Row"] & { onboarding_answers: Json };
  Insert: GeneratedSellerProfiles["Insert"] & { onboarding_answers?: Json };
  Update: GeneratedSellerProfiles["Update"] & { onboarding_answers?: Json };
};
type GeneratedSupportKnowledgeBase = GeneratedDatabase["public"]["Tables"]["support_knowledge_base"];
type SupportKnowledgeBaseFields = { source_type: string; file_name: string | null };
type SupportKnowledgeBase = Omit<GeneratedSupportKnowledgeBase, "Row" | "Insert" | "Update"> & {
  Row: GeneratedSupportKnowledgeBase["Row"] & SupportKnowledgeBaseFields;
  Insert: GeneratedSupportKnowledgeBase["Insert"] & Partial<SupportKnowledgeBaseFields>;
  Update: GeneratedSupportKnowledgeBase["Update"] & Partial<SupportKnowledgeBaseFields>;
};
type GeneratedFreeDesigns = GeneratedDatabase["public"]["Tables"]["free_designs"];
type FreeDesigns = Omit<GeneratedFreeDesigns, "Row" | "Insert" | "Update"> & {
  Row: GeneratedFreeDesigns["Row"] & { is_premium: boolean };
  Insert: GeneratedFreeDesigns["Insert"] & { is_premium?: boolean };
  Update: GeneratedFreeDesigns["Update"] & { is_premium?: boolean };
};
type GeneratedRefunds = GeneratedDatabase["public"]["Tables"]["refunds"];
type RefundFields = {
  destination: string | null;
  destination_card_number: string | null;
  receipt_file_id: string | null;
  transfer_reference: string | null;
};
type Refunds = Omit<GeneratedRefunds, "Row" | "Insert" | "Update" | "Relationships"> & {
  Row: GeneratedRefunds["Row"] & RefundFields;
  Insert: GeneratedRefunds["Insert"] & Partial<RefundFields>;
  Update: GeneratedRefunds["Update"] & Partial<RefundFields>;
  Relationships: [
    ...GeneratedRefunds["Relationships"],
    { foreignKeyName: "refunds_receipt_file_id_fkey"; columns: ["receipt_file_id"]; isOneToOne: false; referencedRelation: "storage_files"; referencedColumns: ["id"] },
  ];
};
type AssetKind = GeneratedDatabase["public"]["Enums"]["asset_kind"] | "CATEGORY_IMAGE" | "GRAPHIC_STYLE_IMAGE";

export type Database = {
  public: Omit<GeneratedDatabase["public"], "Tables" | "Functions" | "Enums"> & {
    Tables: Omit<GeneratedDatabase["public"]["Tables"], "orders" | "profiles" | "seller_profiles" | "support_knowledge_base" | "free_designs" | "refunds"> & AdditionalTables & {
      orders: Orders;
      profiles: Profiles;
      seller_profiles: SellerProfiles;
      support_knowledge_base: SupportKnowledgeBase;
      free_designs: FreeDesigns;
      refunds: Refunds;
    };
    Functions: GeneratedDatabase["public"]["Functions"] & AdditionalFunctions;
    Enums: Omit<GeneratedDatabase["public"]["Enums"], "order_state" | "asset_kind"> & {
      order_state: OrderState;
      asset_kind: AssetKind;
    };
  };
};

export type { Json };
