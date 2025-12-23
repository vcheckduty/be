const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://admin:05112004@vcheck.yga82jd.mongodb.net/vcheck?retryWrites=true&w=majority&appName=vcheck";

console.log('🔄 Migration: Adding members array to existing offices...');

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = mongoose.connection.db;
    
    // Update all offices to have empty members array if not exists
    const result = await db.collection('offices').updateMany(
      { members: { $exists: false } },
      { $set: { members: [] } }
    );
    
    console.log(`📝 Updated ${result.modifiedCount} offices with empty members array`);
    
    // Update all users to have officeId field if not exists
    const userResult = await db.collection('users').updateMany(
      { officeId: { $exists: false } },
      { $set: { officeId: null } }
    );
    
    console.log(`📝 Updated ${userResult.modifiedCount} users with officeId field`);
    
    // Show current state
    const offices = await db.collection('offices').find({}).toArray();
    console.log('\n📋 Current offices:');
    offices.forEach(office => {
      console.log(`  - ${office.name}: ${office.members?.length || 0} members`);
    });
    
    mongoose.connection.close();
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    mongoose.connection.close();
    process.exit(1);
  });
