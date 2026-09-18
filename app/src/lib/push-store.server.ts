import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type StoredFcmRegistration = {
  token: string;
  userId: string;
  organizationId: string;
  counterId: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  userId: string;
  organizationId: string;
  counterId: string;
  p256dh: string;
  auth: string;
};

let database: DatabaseSync | null = null;

function getDatabasePath() {
  return (
    process.env.COUNTER_PUSH_DB_PATH ??
    join(process.cwd(), "data", "counter-push.sqlite")
  );
}

function getDatabase() {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS push_subscription (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      counter_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS push_subscription_user_idx
      ON push_subscription (user_id);

    CREATE INDEX IF NOT EXISTS push_subscription_counter_idx
      ON push_subscription (organization_id, counter_id);
  `);

  return database;
}

export function upsertPushSubscription(subscription: StoredPushSubscription) {
  getDatabase()
    .prepare(`
      INSERT INTO push_subscription (
        endpoint,
        user_id,
        organization_id,
        counter_id,
        p256dh,
        auth
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        organization_id = excluded.organization_id,
        counter_id = excluded.counter_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        updated_at = CURRENT_TIMESTAMP
    `)
    .run(
      subscription.endpoint,
      subscription.userId,
      subscription.organizationId,
      subscription.counterId,
      subscription.p256dh,
      subscription.auth,
    );
}

export function deletePushSubscription(endpoint: string, userId: string) {
  getDatabase()
    .prepare(
      `DELETE FROM push_subscription WHERE endpoint = ? AND user_id = ?`,
    )
    .run(endpoint, userId);
}

export function listPushSubscriptionsForCounter(
  organizationId: string,
  counterId: string,
) {
  return getDatabase()
    .prepare(`
      SELECT
        endpoint,
        user_id AS userId,
        organization_id AS organizationId,
        counter_id AS counterId,
        p256dh,
        auth
      FROM push_subscription
      WHERE organization_id = ? AND counter_id = ?
    `)
    .all(organizationId, counterId) as StoredPushSubscription[];
}


export function upsertFcmRegistration(registration: StoredFcmRegistration) {
  getDatabase()
    .prepare(`
      INSERT INTO fcm_registration (
        token,
        user_id,
        organization_id,
        counter_id
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        user_id = excluded.user_id,
        organization_id = excluded.organization_id,
        counter_id = excluded.counter_id,
        updated_at = CURRENT_TIMESTAMP
    `)
    .run(
      registration.token,
      registration.userId,
      registration.organizationId,
      registration.counterId,
    );
}

export function deleteFcmRegistration(token: string, userId: string) {
  getDatabase()
    .prepare(`DELETE FROM fcm_registration WHERE token = ? AND user_id = ?`)
    .run(token, userId);
}

export function listFcmRegistrationsForCounter(
  organizationId: string,
  counterId: string,
) {
  return getDatabase()
    .prepare(`
      SELECT
        token,
        user_id AS userId,
        organization_id AS organizationId,
        counter_id AS counterId
      FROM fcm_registration
      WHERE organization_id = ? AND counter_id = ?
    `)
    .all(organizationId, counterId) as StoredFcmRegistration[];
}
