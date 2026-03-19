const { MongoClient } = require('mongodb');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.DB_NAME || 'tracker11';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const investments = db.collection('investments');

    // No initial investment records. Users should create their own entries.
    const docs = [];

    const ops = docs.map(d => ({
      updateOne: {
        filter: { date: d.date, company: d.company, amount: d.amount },
        update: { $setOnInsert: d },
        upsert: true
      }
    }));

    const result = await investments.bulkWrite(ops, { ordered: false });
    console.log(`upserted ${result.upsertedCount} docs (modified ${result.modifiedCount})`);
  } catch (err) {
    console.error('seed investments error', err);
  } finally {
    await client.close();
  }
}

main();