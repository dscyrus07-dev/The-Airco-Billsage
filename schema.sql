-- =============================================================================
-- SMART AUDITING TOOL - COMPLETE DATABASE SCHEMA
-- PostgreSQL 17 | Version 2.0
-- Covers: Companies, Users, Parties, Products, Sales, Purchases,
--         Payments, GST (Input/Output), Ledger, Audit Trail
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- for fuzzy search on names

-- =============================================================================
-- UTILITY FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper macro to attach the trigger
CREATE OR REPLACE FUNCTION _attach_updated_at(tbl TEXT) RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%1$s_set_updated_at ON %1$s;
         CREATE TRIGGER trg_%1$s_set_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();', tbl);
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- SECTION 1 — COMPANIES & USERS  (from original, kept intact + minor fixes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_code        VARCHAR(30)  NOT NULL UNIQUE,
    legal_name          VARCHAR(255) NOT NULL,
    trade_name          VARCHAR(255),
    display_name        VARCHAR(255),
    primary_email       VARCHAR(255),
    primary_phone       VARCHAR(20),
    logo_url            TEXT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','inactive','suspended')),
    base_currency       CHAR(3)      NOT NULL DEFAULT 'INR',
    timezone            VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_companies_legal_name ON companies(legal_name);
CREATE INDEX IF NOT EXISTS idx_companies_status     ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at);
SELECT _attach_updated_at('companies');

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS company_details (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    address_line_1              VARCHAR(255),
    address_line_2              VARCHAR(255),
    landmark                    VARCHAR(255),
    city                        VARCHAR(100),
    district                    VARCHAR(100),
    state                       VARCHAR(100),
    country                     VARCHAR(100) NOT NULL DEFAULT 'India',
    postal_code                 VARCHAR(20),
    pan                         VARCHAR(20),
    gstin                       VARCHAR(20),
    cin                         VARCHAR(30),
    tan                         VARCHAR(20),
    bank_account_name           VARCHAR(255),
    bank_name                   VARCHAR(255),
    bank_branch                 VARCHAR(255),
    bank_account_number_encrypted TEXT,
    bank_account_number_masked  VARCHAR(30),
    ifsc_code                   VARCHAR(20),
    upi_id                      VARCHAR(100),
    billing_email               VARCHAR(255),
    support_email               VARCHAR(255),
    alternate_phone             VARCHAR(20),
    website                     VARCHAR(255),
    financial_year_start_month  SMALLINT NOT NULL DEFAULT 4
                                    CHECK (financial_year_start_month BETWEEN 1 AND 12),
    invoice_prefix              VARCHAR(20) DEFAULT 'INV',
    credit_note_prefix          VARCHAR(20) DEFAULT 'CN',
    debit_note_prefix           VARCHAR(20) DEFAULT 'DN',
    payment_prefix              VARCHAR(20) DEFAULT 'PAY',
    receipt_prefix              VARCHAR(20) DEFAULT 'REC',
    po_prefix                   VARCHAR(20) DEFAULT 'PO',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cd_pan   UNIQUE (pan),
    CONSTRAINT uq_cd_gstin UNIQUE (gstin),
    CONSTRAINT uq_cd_cin   UNIQUE (cin)
);
CREATE INDEX IF NOT EXISTS idx_company_details_company_id ON company_details(company_id);
SELECT _attach_updated_at('company_details');

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS company_settings (
    id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                          UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    -- Notification Settings
    notification_duplicate_invoice      BOOLEAN NOT NULL DEFAULT TRUE,
    notification_gst_mismatch           BOOLEAN NOT NULL DEFAULT TRUE,
    notification_overdue_receivable     BOOLEAN NOT NULL DEFAULT TRUE,
    notification_overdue_payable        BOOLEAN NOT NULL DEFAULT TRUE,
    notification_concentration_risk     BOOLEAN NOT NULL DEFAULT TRUE,
    notification_gstr_reminders         BOOLEAN NOT NULL DEFAULT TRUE,
    -- Audit Settings
    lock_after_approval                 BOOLEAN NOT NULL DEFAULT FALSE,
    dual_approval                       BOOLEAN NOT NULL DEFAULT FALSE,
    dual_approval_threshold             NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);
SELECT _attach_updated_at('company_settings');

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    full_name               VARCHAR(255) NOT NULL,
    username                VARCHAR(100) NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    phone                   VARCHAR(20),
    password_hash           TEXT NOT NULL,
    role                    VARCHAR(50) NOT NULL
                                CHECK (role IN ('super_admin','admin','accountant','operator','viewer')),
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','invited','suspended','disabled')),
    is_email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    is_phone_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password    BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts   INT     NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until            TIMESTAMPTZ,
    last_login_at           TIMESTAMPTZ,
    last_password_changed_at TIMESTAMPTZ,
    created_by              UUID,
    updated_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT uq_users_company_username UNIQUE (company_id, username),
    CONSTRAINT uq_users_company_email    UNIQUE (company_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status     ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
SELECT _attach_updated_at('users');

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    session_token_hash  TEXT NOT NULL,
    refresh_token_hash  TEXT,
    device_info         TEXT,
    ip_address          INET,
    user_agent          TEXT,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_company_id ON user_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked_at ON user_sessions(revoked_at);


-- =============================================================================
-- SECTION 2 — PARTIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS parties (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    party_code              VARCHAR(30) NOT NULL,
    party_name              VARCHAR(255) NOT NULL,
    display_name            VARCHAR(255),
    is_supplier             BOOLEAN NOT NULL DEFAULT FALSE,
    is_customer             BOOLEAN NOT NULL DEFAULT FALSE,
    party_category          VARCHAR(30) NOT NULL DEFAULT 'business'
                                CHECK (party_category IN ('business','individual')),
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','inactive','blocked')),
    email                   VARCHAR(255),
    phone                   VARCHAR(20),
    alternate_phone         VARCHAR(20),
    website                 VARCHAR(255),
    address                 VARCHAR(500),
    state                   VARCHAR(50),
    pin_code                VARCHAR(6),
    gstin                   VARCHAR(20),
    pan                     VARCHAR(20),
    cin                     VARCHAR(30),
    tan                     VARCHAR(20),
    credit_limit            NUMERIC(18,2) NOT NULL DEFAULT 0,
    payment_terms_days      INT           NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
    opening_balance         NUMERIC(18,2) NOT NULL DEFAULT 0,
    opening_balance_type    VARCHAR(10)   CHECK (opening_balance_type IN ('dr','cr')),
    notes                   TEXT,
    created_by              UUID,
    updated_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT uq_parties_company_code  UNIQUE (company_id, party_code),
    CONSTRAINT uq_parties_company_gstin UNIQUE (company_id, gstin),
    CONSTRAINT uq_parties_company_pan   UNIQUE (company_id, pan),
    CONSTRAINT chk_parties_type CHECK (is_supplier = TRUE OR is_customer = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_parties_company_id   ON parties(company_id);
CREATE INDEX IF NOT EXISTS idx_parties_party_name   ON parties USING gin(party_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parties_status       ON parties(status);
CREATE INDEX IF NOT EXISTS idx_parties_is_supplier  ON parties(is_supplier) WHERE is_supplier = TRUE;
CREATE INDEX IF NOT EXISTS idx_parties_is_customer  ON parties(is_customer) WHERE is_customer = TRUE;
CREATE INDEX IF NOT EXISTS idx_parties_deleted_at   ON parties(deleted_at);
SELECT _attach_updated_at('parties');

CREATE TABLE IF NOT EXISTS party_addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    address_type    VARCHAR(20) NOT NULL
                        CHECK (address_type IN ('billing','shipping','registered','office','other')),
    address_line_1  VARCHAR(255),
    address_line_2  VARCHAR(255),
    landmark        VARCHAR(255),
    city            VARCHAR(100),
    district        VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100) NOT NULL DEFAULT 'India',
    postal_code     VARCHAR(20),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_addresses_party_id ON party_addresses(party_id);
SELECT _attach_updated_at('party_addresses');

CREATE TABLE IF NOT EXISTS party_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    contact_name    VARCHAR(255) NOT NULL,
    designation     VARCHAR(100),
    department      VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(20),
    alternate_phone VARCHAR(20),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_contacts_party_id ON party_contacts(party_id);
SELECT _attach_updated_at('party_contacts');

CREATE TABLE IF NOT EXISTS party_bank_accounts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id                    UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    account_holder_name         VARCHAR(255),
    bank_name                   VARCHAR(255),
    branch_name                 VARCHAR(255),
    account_number_encrypted    TEXT,
    account_number_masked       VARCHAR(30),
    ifsc_code                   VARCHAR(20),
    upi_id                      VARCHAR(100),
    is_primary                  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_bank_accounts_party_id ON party_bank_accounts(party_id);
SELECT _attach_updated_at('party_bank_accounts');


-- =============================================================================
-- SECTION 3 — CHART OF ACCOUNTS (Ledger Master)
-- =============================================================================
-- Standard double-entry accounts tree.
-- Leaf accounts are linked to transactions.

CREATE TABLE IF NOT EXISTS account_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES account_groups(id),
    name            VARCHAR(255) NOT NULL,
    nature          VARCHAR(20)  NOT NULL
                        CHECK (nature IN ('assets','liabilities','income','expense','equity')),
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,  -- system groups cannot be deleted
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_account_groups_company_name UNIQUE (company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_account_groups_company_id ON account_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_account_groups_parent_id  ON account_groups(parent_id);
SELECT _attach_updated_at('account_groups');

CREATE TABLE IF NOT EXISTS accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES account_groups(id),
    account_code    VARCHAR(30) NOT NULL,
    account_name    VARCHAR(255) NOT NULL,
    nature          VARCHAR(20) NOT NULL
                        CHECK (nature IN ('assets','liabilities','income','expense','equity')),
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    opening_balance_type VARCHAR(5) CHECK (opening_balance_type IN ('dr','cr')),
    party_id        UUID REFERENCES parties(id),   -- if account is linked to a party
    notes           TEXT,
    created_by      UUID,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_accounts_company_code UNIQUE (company_id, account_code),
    CONSTRAINT uq_accounts_company_name UNIQUE (company_id, account_name)
);
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_group_id   ON accounts(group_id);
CREATE INDEX IF NOT EXISTS idx_accounts_party_id   ON accounts(party_id);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON accounts(deleted_at);
SELECT _attach_updated_at('accounts');


-- =============================================================================
-- SECTION 4 — PRODUCT CATEGORIES & PRODUCTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES product_categories(id),
    category_code   VARCHAR(30) NOT NULL,
    category_name   VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_product_categories_code UNIQUE (company_id, category_code)
);
CREATE INDEX IF NOT EXISTS idx_product_categories_company_id ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id  ON product_categories(parent_id);
SELECT _attach_updated_at('product_categories');

-- Units of measure
CREATE TABLE IF NOT EXISTS units_of_measure (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uom_code        VARCHAR(20) NOT NULL,
    uom_name        VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_uom_company_code UNIQUE (company_id, uom_code)
);

-- GST Tax rates master
CREATE TABLE IF NOT EXISTS tax_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tax_name        VARCHAR(100) NOT NULL,     -- e.g. 'GST 18%', 'GST 5%', 'Exempt'
    tax_type        VARCHAR(20)  NOT NULL
                        CHECK (tax_type IN ('gst','igst','exempt','nil','cess','other')),
    cgst_rate       NUMERIC(6,3) NOT NULL DEFAULT 0,
    sgst_rate       NUMERIC(6,3) NOT NULL DEFAULT 0,
    igst_rate       NUMERIC(6,3) NOT NULL DEFAULT 0,
    cess_rate       NUMERIC(6,3) NOT NULL DEFAULT 0,
    total_rate      NUMERIC(6,3) GENERATED ALWAYS AS (cgst_rate + sgst_rate + igst_rate + cess_rate) STORED,
    hsn_sac_code    VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_rates_company_name UNIQUE (company_id, tax_name)
);
CREATE INDEX IF NOT EXISTS idx_tax_rates_company_id ON tax_rates(company_id);
SELECT _attach_updated_at('tax_rates');

-- Products / Services master
CREATE TABLE IF NOT EXISTS products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_id         UUID REFERENCES product_categories(id),
    product_code        VARCHAR(50) NOT NULL,
    product_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    product_type        VARCHAR(20) NOT NULL DEFAULT 'goods'
                            CHECK (product_type IN ('goods','service','combo')),
    hsn_sac_code        VARCHAR(20),
    uom_id              UUID REFERENCES units_of_measure(id),
    secondary_uom_id    UUID REFERENCES units_of_measure(id),
    tax_rate_id         UUID REFERENCES tax_rates(id),
    -- Pricing
    purchase_price      NUMERIC(18,4) NOT NULL DEFAULT 0,
    selling_price       NUMERIC(18,4) NOT NULL DEFAULT 0,
    mrp                 NUMERIC(18,4),
    -- Inventory
    track_inventory     BOOLEAN NOT NULL DEFAULT TRUE,
    opening_stock       NUMERIC(18,4) NOT NULL DEFAULT 0,
    opening_stock_value NUMERIC(18,2) NOT NULL DEFAULT 0,
    reorder_level       NUMERIC(18,4),
    -- Accounts linkage
    sales_account_id    UUID REFERENCES accounts(id),
    purchase_account_id UUID REFERENCES accounts(id),
    stock_account_id    UUID REFERENCES accounts(id),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_products_company_code UNIQUE (company_id, product_code)
);
CREATE INDEX IF NOT EXISTS idx_products_company_id   ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON products USING gin(product_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_hsn_sac_code ON products(hsn_sac_code);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at   ON products(deleted_at);
SELECT _attach_updated_at('products');

-- Product price history (audit trail of price changes)
CREATE TABLE IF NOT EXISTS product_price_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_type      VARCHAR(20) NOT NULL CHECK (price_type IN ('purchase','selling','mrp')),
    old_price       NUMERIC(18,4),
    new_price       NUMERIC(18,4),
    changed_by      UUID REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT
);
CREATE INDEX IF NOT EXISTS idx_product_price_history_product_id ON product_price_history(product_id);


-- =============================================================================
-- SECTION 5 — FINANCIAL YEARS & NUMBER SERIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS financial_years (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_label        VARCHAR(20) NOT NULL,  -- e.g. '2024-25'
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,  -- locked after GST filing
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fy_company_label UNIQUE (company_id, fy_label),
    CONSTRAINT chk_fy_dates CHECK (end_date > start_date)
);
CREATE INDEX IF NOT EXISTS idx_financial_years_company_id ON financial_years(company_id);

-- Document numbering sequences per type per FY
CREATE TABLE IF NOT EXISTS document_sequences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_id           UUID NOT NULL REFERENCES financial_years(id),
    doc_type        VARCHAR(30) NOT NULL,  -- 'invoice','credit_note','purchase','payment','receipt','po','dn'
    prefix          VARCHAR(20) NOT NULL,
    suffix          VARCHAR(20),
    current_number  INT NOT NULL DEFAULT 0,
    padding_length  SMALLINT NOT NULL DEFAULT 4,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_sequences_company_fy_type UNIQUE (company_id, fy_id, doc_type)
);
SELECT _attach_updated_at('document_sequences');


-- =============================================================================
-- SECTION 6 — COST CENTRES (optional, for analytics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_centres (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES cost_centres(id),
    cc_code         VARCHAR(30) NOT NULL,
    cc_name         VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cost_centres_company_code UNIQUE (company_id, cc_code)
);
SELECT _attach_updated_at('cost_centres');


-- =============================================================================
-- SECTION 7 — VOUCHERS (the central transaction table)
-- =============================================================================
-- All financial events are vouchers. Sale invoices, purchase bills,
-- payments, receipts, journal entries — all live here.

CREATE TABLE IF NOT EXISTS vouchers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    fy_id               UUID NOT NULL REFERENCES financial_years(id),
    voucher_type        VARCHAR(30) NOT NULL
                            CHECK (voucher_type IN (
                                'sale','purchase','credit_note','debit_note',
                                'payment','receipt','journal','contra',
                                'purchase_order','delivery_challan','proforma'
                            )),
    voucher_number      VARCHAR(50) NOT NULL,
    voucher_date        DATE NOT NULL,
    ref_number          VARCHAR(100),   -- party's ref / PO number
    ref_date            DATE,
    party_id            UUID REFERENCES parties(id),
    billing_address_id  UUID REFERENCES party_addresses(id),
    shipping_address_id UUID REFERENCES party_addresses(id),
    -- Amounts (all in base currency)
    subtotal            NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
    taxable_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    cess_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    tds_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
    tcs_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
    round_off           NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    balance_amount      NUMERIC(18,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    -- GST supply classification
    supply_type         VARCHAR(20)   CHECK (supply_type IN ('B2B','B2C','B2CL','export','SEZ','exempt','nil')),
    place_of_supply     VARCHAR(100), -- state name / code
    reverse_charge      BOOLEAN NOT NULL DEFAULT FALSE,
    -- Workflow
    status              VARCHAR(20)   NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','confirmed','cancelled','amended')),
    is_einvoice         BOOLEAN NOT NULL DEFAULT FALSE,
    irn                 VARCHAR(100),   -- e-Invoice IRN
    ack_number          VARCHAR(100),
    ack_date            TIMESTAMPTZ,
    ewb_number          VARCHAR(100),   -- e-Way Bill
    ewb_date            TIMESTAMPTZ,
    ewb_valid_until     TIMESTAMPTZ,
    -- Link for amendments / credit notes against original
    original_voucher_id UUID REFERENCES vouchers(id),
    notes               TEXT,
    terms_and_conditions TEXT,
    cost_centre_id      UUID REFERENCES cost_centres(id),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    confirmed_by        UUID REFERENCES users(id),
    confirmed_at        TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_vouchers_company_number UNIQUE (company_id, voucher_number, voucher_type)
);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_id      ON vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_fy_id           ON vouchers(fy_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_type    ON vouchers(voucher_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_date    ON vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_party_id        ON vouchers(party_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status          ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_supply_type     ON vouchers(supply_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_irn             ON vouchers(irn) WHERE irn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_deleted_at      ON vouchers(deleted_at);
-- Composite for common report queries
CREATE INDEX IF NOT EXISTS idx_vouchers_company_type_date ON vouchers(company_id, voucher_type, voucher_date);
SELECT _attach_updated_at('vouchers');


-- =============================================================================
-- SECTION 8 — VOUCHER LINE ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS voucher_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id          UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    line_number         SMALLINT NOT NULL,
    product_id          UUID REFERENCES products(id),
    description         TEXT NOT NULL,
    hsn_sac_code        VARCHAR(20),
    uom_id              UUID REFERENCES units_of_measure(id),
    quantity            NUMERIC(18,4) NOT NULL DEFAULT 0,
    rate                NUMERIC(18,4) NOT NULL DEFAULT 0,
    gross_amount        NUMERIC(18,2) GENERATED ALWAYS AS (quantity * rate) STORED,
    discount_pct        NUMERIC(6,3)  NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
    taxable_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_rate_id         UUID REFERENCES tax_rates(id),
    cgst_rate           NUMERIC(6,3)  NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    sgst_rate           NUMERIC(6,3)  NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    igst_rate           NUMERIC(6,3)  NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    cess_rate           NUMERIC(6,3)  NOT NULL DEFAULT 0,
    cess_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    line_total          NUMERIC(18,2) NOT NULL DEFAULT 0,
    -- Account override (if different from product default)
    account_id          UUID REFERENCES accounts(id),
    cost_centre_id      UUID REFERENCES cost_centres(id),
    batch_number        VARCHAR(100),
    serial_numbers      TEXT[],        -- for serialised goods
    expiry_date         DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_voucher_items_line UNIQUE (voucher_id, line_number)
);
CREATE INDEX IF NOT EXISTS idx_voucher_items_voucher_id  ON voucher_items(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_items_product_id  ON voucher_items(product_id);
CREATE INDEX IF NOT EXISTS idx_voucher_items_hsn_sac     ON voucher_items(hsn_sac_code);


-- =============================================================================
-- SECTION 9 — VOUCHER CHARGES (freight, packaging, other charges)
-- =============================================================================

CREATE TABLE IF NOT EXISTS voucher_charges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    charge_name     VARCHAR(255) NOT NULL,
    amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_rate_id     UUID REFERENCES tax_rates(id),
    tax_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
    account_id      UUID REFERENCES accounts(id),
    is_deduction    BOOLEAN NOT NULL DEFAULT FALSE,  -- deduction vs addition
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voucher_charges_voucher_id ON voucher_charges(voucher_id);


-- =============================================================================
-- SECTION 10 — DOUBLE-ENTRY LEDGER (General Ledger)
-- =============================================================================
-- Every confirmed voucher posts debit/credit entries here.
-- This is the source of truth for all account balances.

CREATE TABLE IF NOT EXISTS ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    entry_date      DATE NOT NULL,
    dr_amount       NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (dr_amount >= 0),
    cr_amount       NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (cr_amount >= 0),
    narration       TEXT,
    cost_centre_id  UUID REFERENCES cost_centres(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ledger_one_side CHECK (
        (dr_amount > 0 AND cr_amount = 0) OR (cr_amount > 0 AND dr_amount = 0)
    )
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_company_id  ON ledger_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_voucher_id  ON ledger_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id  ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_date  ON ledger_entries(entry_date);
-- Composite for ledger report
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_date ON ledger_entries(account_id, entry_date);


-- =============================================================================
-- SECTION 11 — PAYMENTS & RECEIPTS
-- =============================================================================
-- Payments/Receipts are also vouchers, but we need additional details
-- for bank reconciliation and payment mode.

CREATE TABLE IF NOT EXISTS payment_details (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id          UUID NOT NULL UNIQUE REFERENCES vouchers(id) ON DELETE CASCADE,
    payment_mode        VARCHAR(30) NOT NULL
                            CHECK (payment_mode IN ('cash','bank_transfer','cheque','upi','card','dd','neft','rtgs','imps','other')),
    payment_account_id  UUID REFERENCES accounts(id),   -- bank/cash account
    cheque_number       VARCHAR(50),
    cheque_date         DATE,
    bank_ref_number     VARCHAR(100),
    upi_ref             VARCHAR(100),
    payment_status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN ('pending','cleared','bounced','cancelled')),
    clearing_date       DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT _attach_updated_at('payment_details');

-- Linking table: payments allocated against specific invoices
CREATE TABLE IF NOT EXISTS payment_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_voucher_id  UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    invoice_voucher_id  UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    allocated_amount    NUMERIC(18,2) NOT NULL CHECK (allocated_amount > 0),
    allocation_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_allocation UNIQUE (payment_voucher_id, invoice_voucher_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment  ON payment_allocations(payment_voucher_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice  ON payment_allocations(invoice_voucher_id);


-- =============================================================================
-- SECTION 12 — TDS (Tax Deducted at Source)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tds_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    section_code    VARCHAR(20) NOT NULL,    -- e.g. '194C', '194J'
    description     VARCHAR(255),
    rate_individual NUMERIC(6,3) NOT NULL DEFAULT 0,
    rate_company    NUMERIC(6,3) NOT NULL DEFAULT 0,
    threshold_limit NUMERIC(18,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tds_sections_company_code UNIQUE (company_id, section_code)
);

CREATE TABLE IF NOT EXISTS tds_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES tds_sections(id),
    party_id        UUID NOT NULL REFERENCES parties(id),
    base_amount     NUMERIC(18,2) NOT NULL,
    tds_rate        NUMERIC(6,3)  NOT NULL,
    tds_amount      NUMERIC(18,2) NOT NULL,
    tds_account_id  UUID REFERENCES accounts(id),
    deducted_at     DATE NOT NULL,
    deposited_at    DATE,
    challan_number  VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tds_entries_company_id ON tds_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_tds_entries_voucher_id ON tds_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_tds_entries_party_id   ON tds_entries(party_id);


-- =============================================================================
-- SECTION 13 — GST RETURNS DATA
-- =============================================================================
-- Normalised GST input/output for GSTR-1, GSTR-2A, GSTR-3B filing.

-- GST Output (GSTR-1) — one row per invoice line per HSN/rate bucket
CREATE TABLE IF NOT EXISTS gst_output_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_id               UUID NOT NULL REFERENCES financial_years(id),
    voucher_id          UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    return_period       CHAR(7)  NOT NULL,  -- 'MMYYYY'
    supply_type         VARCHAR(20) NOT NULL
                            CHECK (supply_type IN ('B2B','B2C','B2CL','CDN','export','nil','exempt','SEZ')),
    party_id            UUID REFERENCES parties(id),
    party_gstin         VARCHAR(20),
    invoice_date        DATE NOT NULL,
    invoice_number      VARCHAR(50) NOT NULL,
    place_of_supply     VARCHAR(100),
    reverse_charge      BOOLEAN NOT NULL DEFAULT FALSE,
    hsn_sac_code        VARCHAR(20),
    description         TEXT,
    uom_code            VARCHAR(20),
    quantity            NUMERIC(18,4),
    taxable_value       NUMERIC(18,2) NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    cess_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    gst_rate            NUMERIC(6,3)  NOT NULL DEFAULT 0,
    is_amended          BOOLEAN NOT NULL DEFAULT FALSE,
    amendment_period    CHAR(7),
    filing_status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (filing_status IN ('pending','filed','amended','cancelled')),
    filed_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gst_output_company_id       ON gst_output_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_gst_output_return_period    ON gst_output_entries(return_period);
CREATE INDEX IF NOT EXISTS idx_gst_output_party_gstin      ON gst_output_entries(party_gstin);
CREATE INDEX IF NOT EXISTS idx_gst_output_voucher_id       ON gst_output_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_gst_output_supply_type      ON gst_output_entries(supply_type);
CREATE INDEX IF NOT EXISTS idx_gst_output_hsn_sac          ON gst_output_entries(hsn_sac_code);
SELECT _attach_updated_at('gst_output_entries');

-- GST Input (GSTR-2A / 2B / ITC) — one row per purchase invoice
CREATE TABLE IF NOT EXISTS gst_input_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_id               UUID NOT NULL REFERENCES financial_years(id),
    voucher_id          UUID REFERENCES vouchers(id),         -- NULL if imported from portal
    return_period       CHAR(7)  NOT NULL,
    source              VARCHAR(20) NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('manual','gstr2a','gstr2b','import')),
    supplier_id         UUID REFERENCES parties(id),
    supplier_gstin      VARCHAR(20) NOT NULL,
    supplier_name       VARCHAR(255),
    invoice_number      VARCHAR(100) NOT NULL,
    invoice_date        DATE NOT NULL,
    invoice_value       NUMERIC(18,2) NOT NULL DEFAULT 0,
    place_of_supply     VARCHAR(100),
    reverse_charge      BOOLEAN NOT NULL DEFAULT FALSE,
    hsn_sac_code        VARCHAR(20),
    taxable_value       NUMERIC(18,2) NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    cess_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    gst_rate            NUMERIC(6,3)  NOT NULL DEFAULT 0,
    itc_eligibility     VARCHAR(20) NOT NULL DEFAULT 'eligible'
                            CHECK (itc_eligibility IN ('eligible','ineligible','blocked','proportionate')),
    itc_availed         BOOLEAN NOT NULL DEFAULT FALSE,
    itc_availed_period  CHAR(7),
    match_status        VARCHAR(20) NOT NULL DEFAULT 'unmatched'
                            CHECK (match_status IN ('matched','unmatched','mismatch','pending','amended')),
    matched_entry_id    UUID REFERENCES gst_output_entries(id),
    filing_status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (filing_status IN ('pending','filed','amended','cancelled')),
    filed_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gst_input_company_id       ON gst_input_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_gst_input_return_period    ON gst_input_entries(return_period);
CREATE INDEX IF NOT EXISTS idx_gst_input_supplier_gstin   ON gst_input_entries(supplier_gstin);
CREATE INDEX IF NOT EXISTS idx_gst_input_voucher_id       ON gst_input_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_gst_input_match_status     ON gst_input_entries(match_status);
CREATE INDEX IF NOT EXISTS idx_gst_input_itc_eligibility  ON gst_input_entries(itc_eligibility);
SELECT _attach_updated_at('gst_input_entries');

-- GSTR-3B summary (monthly tax payable / paid)
CREATE TABLE IF NOT EXISTS gstr3b_summary (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_id                   UUID NOT NULL REFERENCES financial_years(id),
    return_period           CHAR(7) NOT NULL,
    -- Outward supplies
    out_taxable_igst        NUMERIC(18,2) NOT NULL DEFAULT 0,
    out_taxable_cgst        NUMERIC(18,2) NOT NULL DEFAULT 0,
    out_taxable_sgst        NUMERIC(18,2) NOT NULL DEFAULT 0,
    out_nil_exempt          NUMERIC(18,2) NOT NULL DEFAULT 0,
    -- ITC
    itc_igst                NUMERIC(18,2) NOT NULL DEFAULT 0,
    itc_cgst                NUMERIC(18,2) NOT NULL DEFAULT 0,
    itc_sgst                NUMERIC(18,2) NOT NULL DEFAULT 0,
    itc_cess                NUMERIC(18,2) NOT NULL DEFAULT 0,
    -- Net payable
    net_igst_payable        NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_cgst_payable        NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_sgst_payable        NUMERIC(18,2) NOT NULL DEFAULT 0,
    -- Challan / payment
    paid_by_itc_igst        NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_by_itc_cgst        NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_by_itc_sgst        NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_by_cash_igst       NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_by_cash_cgst       NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_by_cash_sgst       NUMERIC(18,2) NOT NULL DEFAULT 0,
    interest_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    late_fee_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    filing_status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (filing_status IN ('pending','filed','revised')),
    filed_at                TIMESTAMPTZ,
    arn                     VARCHAR(100),  -- Acknowledgement Reference Number
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_gstr3b_company_period UNIQUE (company_id, return_period)
);
SELECT _attach_updated_at('gstr3b_summary');


-- =============================================================================
-- SECTION 14 — INVENTORY MOVEMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    product_id      UUID NOT NULL REFERENCES products(id),
    voucher_id      UUID REFERENCES vouchers(id),
    movement_type   VARCHAR(30) NOT NULL
                        CHECK (movement_type IN (
                            'opening','purchase','sale','return_in','return_out',
                            'transfer_in','transfer_out','adjustment','write_off','production'
                        )),
    movement_date   DATE NOT NULL,
    quantity        NUMERIC(18,4) NOT NULL,  -- positive=in, negative=out
    unit_cost       NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_value     NUMERIC(18,2) NOT NULL DEFAULT 0,
    batch_number    VARCHAR(100),
    expiry_date     DATE,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_company_id    ON inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_product_id    ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_voucher_id    ON inventory_movements(voucher_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_date          ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type          ON inventory_movements(movement_type);

-- Materialized view: current stock (refresh after each movement)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_current_stock AS
SELECT
    company_id,
    product_id,
    SUM(quantity)       AS qty_on_hand,
    SUM(total_value)    AS stock_value,
    MAX(movement_date)  AS last_movement_date
FROM inventory_movements
GROUP BY company_id, product_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_current_stock_pk
    ON mv_current_stock(company_id, product_id);


-- =============================================================================
-- SECTION 15 — BANK RECONCILIATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL UNIQUE REFERENCES accounts(id),  -- links to ledger account
    bank_name       VARCHAR(255) NOT NULL,
    branch_name     VARCHAR(255),
    account_number_encrypted TEXT,
    account_number_masked    VARCHAR(30),
    ifsc_code       VARCHAR(20),
    account_type    VARCHAR(20) NOT NULL DEFAULT 'current'
                        CHECK (account_type IN ('current','savings','overdraft','cc')),
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT _attach_updated_at('bank_accounts');

CREATE TABLE IF NOT EXISTS bank_statements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id     UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date    DATE NOT NULL,
    value_date          DATE,
    description         TEXT,
    ref_number          VARCHAR(100),
    debit_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
    closing_balance     NUMERIC(18,2),
    reconciliation_status VARCHAR(20) NOT NULL DEFAULT 'unreconciled'
                            CHECK (reconciliation_status IN ('unreconciled','reconciled','ignored')),
    ledger_entry_id     UUID REFERENCES ledger_entries(id),
    reconciled_by       UUID REFERENCES users(id),
    reconciled_at       TIMESTAMPTZ,
    import_batch_id     UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_statements_bank_account_id ON bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_date            ON bank_statements(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_statements_status         ON bank_statements(reconciliation_status);


-- =============================================================================
-- SECTION 16 — PURCHASE ORDERS
-- =============================================================================
-- POs are also vouchers (voucher_type = 'purchase_order'), but we store
-- additional fulfilment tracking here.

CREATE TABLE IF NOT EXISTS purchase_order_fulfilment (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_voucher_id       UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    bill_voucher_id     UUID NOT NULL REFERENCES vouchers(id),
    po_item_id          UUID NOT NULL REFERENCES voucher_items(id),
    billed_quantity     NUMERIC(18,4) NOT NULL CHECK (billed_quantity > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_fulfilment_po_id   ON purchase_order_fulfilment(po_voucher_id);
CREATE INDEX IF NOT EXISTS idx_po_fulfilment_bill_id ON purchase_order_fulfilment(bill_voucher_id);


-- =============================================================================
-- SECTION 17 — AUDIT TRAIL
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id      UUID,
    user_id         UUID,
    session_id      UUID,
    action          VARCHAR(50) NOT NULL,   -- 'INSERT','UPDATE','DELETE','LOGIN','EXPORT', etc.
    table_name      VARCHAR(100),
    record_id       UUID,
    old_data        JSONB,
    new_data        JSONB,
    diff            JSONB,                  -- computed delta
    ip_address      INET,
    user_agent      TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id  ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id     ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name  ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id   ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON audit_log(occurred_at);
-- GIN index on JSONB for full-change search
CREATE INDEX IF NOT EXISTS idx_audit_log_new_data_gin ON audit_log USING gin(new_data);


-- =============================================================================
-- SECTION 18 — NOTIFICATIONS & ALERTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),    -- NULL = broadcast to all
    notification_type VARCHAR(50) NOT NULL,        -- 'payment_due','gst_deadline','low_stock', etc.
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    reference_type  VARCHAR(50),                   -- 'voucher','party','product', etc.
    reference_id    UUID,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read) WHERE is_read = FALSE;


-- =============================================================================
-- SECTION 19 — REPORT SNAPSHOTS (for cached report storage)
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    report_type     VARCHAR(100) NOT NULL,   -- 'trial_balance','p&l','balance_sheet','gstr1', etc.
    fy_id           UUID REFERENCES financial_years(id),
    as_of_date      DATE,
    parameters      JSONB,                   -- filters used to generate report
    snapshot_data   JSONB NOT NULL,
    generated_by    UUID REFERENCES users(id),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_company_id ON report_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_type       ON report_snapshots(report_type);


-- =============================================================================
-- SECTION 20 — USEFUL VIEWS
-- =============================================================================

-- Outstanding invoices (receivables + payables)
CREATE OR REPLACE VIEW v_outstanding_invoices AS
SELECT
    v.id,
    v.company_id,
    v.voucher_type,
    v.voucher_number,
    v.voucher_date,
    v.party_id,
    p.party_name,
    p.gstin AS party_gstin,
    v.total_amount,
    v.paid_amount,
    v.balance_amount,
    v.status,
    (CURRENT_DATE - v.voucher_date) AS age_days
FROM vouchers v
JOIN parties p ON p.id = v.party_id
WHERE v.voucher_type IN ('sale','purchase')
  AND v.status = 'confirmed'
  AND v.balance_amount > 0
  AND v.deleted_at IS NULL;

-- HSN-wise GST summary (for GSTR-1 HSN table)
CREATE OR REPLACE VIEW v_hsn_gst_summary AS
SELECT
    go.company_id,
    go.return_period,
    go.hsn_sac_code,
    go.gst_rate,
    SUM(go.taxable_value)  AS total_taxable,
    SUM(go.igst_amount)    AS total_igst,
    SUM(go.cgst_amount)    AS total_cgst,
    SUM(go.sgst_amount)    AS total_sgst,
    SUM(go.cess_amount)    AS total_cess,
    COUNT(*)               AS invoice_count
FROM gst_output_entries go
WHERE go.filing_status != 'cancelled'
GROUP BY go.company_id, go.return_period, go.hsn_sac_code, go.gst_rate;

-- Account balance summary
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
    le.company_id,
    le.account_id,
    a.account_name,
    a.nature,
    ag.name AS group_name,
    SUM(le.dr_amount) AS total_debit,
    SUM(le.cr_amount) AS total_credit,
    CASE a.nature
        WHEN 'assets'    THEN SUM(le.dr_amount) - SUM(le.cr_amount)
        WHEN 'expense'   THEN SUM(le.dr_amount) - SUM(le.cr_amount)
        WHEN 'liabilities' THEN SUM(le.cr_amount) - SUM(le.dr_amount)
        WHEN 'income'    THEN SUM(le.cr_amount) - SUM(le.dr_amount)
        WHEN 'equity'    THEN SUM(le.cr_amount) - SUM(le.dr_amount)
    END AS closing_balance
FROM ledger_entries le
JOIN accounts a  ON a.id = le.account_id
JOIN account_groups ag ON ag.id = a.group_id
GROUP BY le.company_id, le.account_id, a.account_name, a.nature, ag.name;


-- =============================================================================
-- SECTION 21 — ROW-LEVEL SECURITY (multi-tenant safety)
-- =============================================================================

ALTER TABLE companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_details       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_output_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_input_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements   ENABLE ROW LEVEL SECURITY;

-- Example policy (app layer passes current_setting('app.company_id'))
-- CREATE POLICY company_isolation ON vouchers
--     USING (company_id = current_setting('app.company_id')::UUID);


-- =============================================================================
-- TRIGGERS — all updated_at triggers via helper
-- =============================================================================

SELECT _attach_updated_at('tax_rates');
SELECT _attach_updated_at('products');
SELECT _attach_updated_at('vouchers');
SELECT _attach_updated_at('payment_details');
SELECT _attach_updated_at('gst_output_entries');
SELECT _attach_updated_at('gst_input_entries');
SELECT _attach_updated_at('gstr3b_summary');
SELECT _attach_updated_at('bank_accounts');
SELECT _attach_updated_at('cost_centres');
SELECT _attach_updated_at('document_sequences');
SELECT _attach_updated_at('product_categories');
SELECT _attach_updated_at('accounts');
SELECT _attach_updated_at('account_groups');


-- =============================================================================
-- FUNCTION: auto-post ledger on voucher confirmation
-- =============================================================================
-- Stub — to be fleshed out per voucher_type in app layer.
-- This enforces that balance_amount never goes negative on payments.

CREATE OR REPLACE FUNCTION fn_check_payment_allocation()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_balance NUMERIC(18,2);
BEGIN
    SELECT balance_amount INTO v_invoice_balance
    FROM vouchers WHERE id = NEW.invoice_voucher_id;

    IF NEW.allocated_amount > v_invoice_balance THEN
        RAISE EXCEPTION 'Allocation % exceeds outstanding balance % on invoice %',
            NEW.allocated_amount, v_invoice_balance, NEW.invoice_voucher_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_payment_allocation ON payment_allocations;
CREATE TRIGGER trg_check_payment_allocation
BEFORE INSERT OR UPDATE ON payment_allocations
FOR EACH ROW EXECUTE FUNCTION fn_check_payment_allocation();


-- =============================================================================
-- FUNCTION: refresh stock materialized view
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_refresh_current_stock()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_stock;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_stock ON inventory_movements;
CREATE TRIGGER trg_refresh_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
FOR EACH STATEMENT EXECUTE FUNCTION fn_refresh_current_stock();


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================