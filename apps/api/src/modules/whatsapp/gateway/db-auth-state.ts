// Baileys auth state stored (encrypted) in Postgres instead of files, so QR sessions survive redeploys.
import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from '@whiskeysockets/baileys';
import { db } from '../../../config/database.js';
import { decryptString, encryptString } from '../../../shared/utils/crypto.js';
import { SESSION_SALT } from '../whatsapp.shared.js';

const TABLE = 'whatsapp_session_keys';

function encode(value: unknown): string {
  return encryptString(JSON.stringify(value, BufferJSON.replacer), SESSION_SALT);
}

function decode<T>(encrypted: string): T {
  return JSON.parse(decryptString(encrypted, SESSION_SALT), BufferJSON.reviver);
}

export async function useDbAuthState(accountId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clear: () => Promise<void>;
}> {
  const credsRow = await db(TABLE).where({ account_id: accountId, category: 'creds', key_id: 'creds' }).first();
  const creds: AuthenticationCreds = credsRow ? decode(credsRow.value_encrypted) : initAuthCreds();

  const write = (category: string, keyId: string, value: unknown) => db(TABLE)
    .insert({ account_id: accountId, category, key_id: keyId, value_encrypted: encode(value), updated_at: new Date() })
    .onConflict(['account_id', 'category', 'key_id'])
    .merge(['value_encrypted', 'updated_at']);

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          if (!ids.length) return result;
          const rows = await db(TABLE).where({ account_id: accountId, category: type }).whereIn('key_id', ids);
          for (const row of rows) {
            let value: any = decode(row.value_encrypted);
            if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
            result[row.key_id] = value;
          }
          return result;
        },
        set: async (data: any) => {
          const deletes: Array<{ category: string; id: string }> = [];
          await db.transaction(async (trx) => {
            for (const category of Object.keys(data)) {
              for (const id of Object.keys(data[category] || {})) {
                const value = data[category][id];
                if (value) {
                  await trx(TABLE)
                    .insert({ account_id: accountId, category, key_id: id, value_encrypted: encode(value), updated_at: new Date() })
                    .onConflict(['account_id', 'category', 'key_id'])
                    .merge(['value_encrypted', 'updated_at']);
                } else {
                  deletes.push({ category, id });
                }
              }
            }
            for (const d of deletes) {
              await trx(TABLE).where({ account_id: accountId, category: d.category, key_id: d.id }).delete();
            }
          });
        },
      },
    },
    saveCreds: async () => { await write('creds', 'creds', creds); },
    clear: async () => { await db(TABLE).where('account_id', accountId).delete(); },
  };
}
