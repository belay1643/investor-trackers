const { MongoClient } = require('mongodb');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.DB_NAME || 'tracker11';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const companies = db.collection('companies');

    // No companies are seeded by default. The user can add their own companies manually or via API.
    const companiesToAdd = []; // empty list

    // Use bulkWrite with upsert to safely add missing companies and avoid duplicates
    const operations = companiesToAdd.map((c) => ({
      updateOne: {
        filter: { name: c.name },
        update: { $setOnInsert: c },
        upsert: true
      }
    }));

    const result = await companies.bulkWrite(operations, { ordered: false });

    const upserted = result.upsertedCount || 0;
    const modified = result.modifiedCount || 0;
    console.log(`Seed complete. Upserted: ${upserted}, Modified: ${modified}`);
    if (upserted === 0) {
      console.log('No new companies were inserted; all seed companies already exist.');
    }
  } catch (err) {
    console.error('Error inserting/updating seed companies:', err.message || err);
  } finally {
    await client.close();
  }
}

main();
