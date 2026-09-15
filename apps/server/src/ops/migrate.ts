import { loadServerConfig } from '../config.ts';
import { createDatabase } from '../shared/db/client.ts';
import { migrate } from '../shared/db/migrate.ts';

/** npm run db:migrate — applies SQL migrations as the owner and sets application role passwords from env. */
function password(url: string): string {
  return decodeURIComponent(new URL(url).password);
}

const config = loadServerConfig();
const db = createDatabase(config.databaseUrls);
try {
  const applied = await migrate(db.ownerPool, {
    appPassword: password(config.databaseUrls.app),
    platformPassword: password(config.databaseUrls.platform),
  });
  process.stdout.write(applied.length ? `Applied: ${applied.join(', ')}\n` : 'Database is up to date\n');
} finally {
  await db.close();
}
