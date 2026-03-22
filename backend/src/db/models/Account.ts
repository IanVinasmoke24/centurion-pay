import db from '../../config/database';

export type AccountRole = 'user' | 'merchant' | 'issuer' | 'distributor';

export interface Account {
  address: string;
  label: string | null;
  role: AccountRole;
  has_mxn_trustline: boolean;
  has_usd_trustline: boolean;
  has_gold_trustline: boolean;
  home_domain: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertAccountInput {
  address: string;
  label?: string;
  role?: AccountRole;
  has_mxn_trustline?: boolean;
  has_usd_trustline?: boolean;
  has_gold_trustline?: boolean;
  home_domain?: string;
  metadata_json?: string;
}

export async function upsert(input: UpsertAccountInput): Promise<Account> {
  const now = new Date().toISOString();
  const existing = await findByAddress(input.address);

  if (existing) {
    const updates: Partial<Account> & { updated_at: string } = {
      updated_at: now,
    };
    if (input.label !== undefined) updates.label = input.label;
    if (input.role !== undefined) updates.role = input.role;
    if (input.has_mxn_trustline !== undefined)
      updates.has_mxn_trustline = input.has_mxn_trustline;
    if (input.has_usd_trustline !== undefined)
      updates.has_usd_trustline = input.has_usd_trustline;
    if (input.has_gold_trustline !== undefined)
      updates.has_gold_trustline = input.has_gold_trustline;
    if (input.home_domain !== undefined)
      updates.home_domain = input.home_domain;
    if (input.metadata_json !== undefined)
      updates.metadata_json = input.metadata_json;

    await db('accounts').where({ address: input.address }).update(updates);
  } else {
    const record = {
      address: input.address,
      label: input.label ?? null,
      role: input.role ?? 'user',
      has_mxn_trustline: input.has_mxn_trustline ?? false,
      has_usd_trustline: input.has_usd_trustline ?? false,
      has_gold_trustline: input.has_gold_trustline ?? false,
      home_domain: input.home_domain ?? null,
      metadata_json: input.metadata_json ?? null,
      created_at: now,
      updated_at: now,
    };
    await db('accounts').insert(record);
  }

  return findByAddress(input.address) as Promise<Account>;
}

export async function findByAddress(
  address: string
): Promise<Account | undefined> {
  return db('accounts').where({ address }).first();
}

export async function updateTrustlines(
  address: string,
  trustlines: {
    has_mxn_trustline?: boolean;
    has_usd_trustline?: boolean;
    has_gold_trustline?: boolean;
  }
): Promise<void> {
  await db('accounts')
    .where({ address })
    .update({
      ...trustlines,
      updated_at: new Date().toISOString(),
    });
}

export async function findByRole(role: AccountRole): Promise<Account[]> {
  return db('accounts').where({ role });
}
