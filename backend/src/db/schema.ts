import { Knex } from 'knex';

export async function createPaymentsTable(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('payments');
  if (!exists) {
    await knex.schema.createTable('payments', (table) => {
      table.string('id').primary().notNullable();
      table.string('qr_session_token').nullable().index();
      table.string('sender_address').notNullable().index();
      table.string('merchant_address').notNullable().index();
      table.string('send_asset').notNullable();
      table.string('dest_asset').notNullable();
      table.decimal('dest_amount', 20, 7).notNullable();
      table.decimal('send_max', 20, 7).notNullable();
      table.decimal('actual_send_amount', 20, 7).nullable();
      table.string('tx_hash').nullable().unique();
      table.string('status').notNullable().defaultTo('pending');
      // pending | building | submitted | settled | failed
      table.string('memo').nullable();
      table.text('path_json').nullable(); // JSON array of path assets
      table.text('error_message').nullable();
      table.integer('ledger').nullable();
      table.timestamps(true, true);
    });
  }
}

export async function createQRSessionsTable(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('qr_sessions');
  if (!exists) {
    await knex.schema.createTable('qr_sessions', (table) => {
      table.string('id').primary().notNullable();
      table.string('token').notNullable().unique().index();
      table.string('merchant_address').notNullable().index();
      table.decimal('amount_mxn', 20, 7).notNullable();
      table.string('status').notNullable().defaultTo('pending');
      // pending | scanned | settled | expired
      table.string('payment_id').nullable();
      table.string('tx_hash').nullable();
      table.timestamp('expires_at').notNullable();
      table.timestamp('scanned_at').nullable();
      table.timestamp('settled_at').nullable();
      table.string('qr_image_base64').nullable();
      table.string('payment_url').nullable();
      table.timestamps(true, true);
    });
  }
}

export async function createAccountsTable(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('accounts');
  if (!exists) {
    await knex.schema.createTable('accounts', (table) => {
      table.string('address').primary().notNullable();
      table.string('label').nullable();
      table.string('role').notNullable().defaultTo('user');
      // user | merchant | issuer | distributor
      table.boolean('has_mxn_trustline').notNullable().defaultTo(false);
      table.boolean('has_usd_trustline').notNullable().defaultTo(false);
      table.boolean('has_gold_trustline').notNullable().defaultTo(false);
      table.string('home_domain').nullable();
      table.text('metadata_json').nullable();
      table.timestamps(true, true);
    });
  }
}
