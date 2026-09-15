import { loadOpsDatabaseUrls } from '../config.ts';
import { createDatabase } from '../shared/db/client.ts';
import { migrate } from '../shared/db/migrate.ts';

/** npm run db:migrate — applies SQL migrations as the owner and sets application role passwords from env. */
function password(url: string): string {
  return decodeURIComponent(new URL(url).password);
}

const urls = loadOpsDatabaseUrls();
const db = createDatabase(urls);
try {
  const applied = await migrate(db.ownerPool, {
    appPassword: password(urls.app),
    platformPassword: password(urls.platform),
  });
  process.stdout.write(applied.length ? `Applied: ${applied.join(', ')}\n` : 'Database is up to date\n');
} finally {
  await db.close();
}
