const { MongoClient } = require('mongodb');
(async ()=>{
  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('tracker11');
    const cols = await db.listCollections().toArray();
    for(const c of cols){
      console.log('===', c.name);
      const docs = await db.collection(c.name).find({$or:[
        {setting:{$exists:true}},
        {name: /setting/i},
        {description: /setting/i},
        {sample: /setting/i},
        {filled: /filled/i},
        {text: /setting/i}
      ]}).limit(20).toArray();
      console.dir(docs,{depth:2});
    }
    await client.close();
  } catch(e) {
    console.error(e);
  }
})();