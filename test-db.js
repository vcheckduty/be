const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://admin:05112004@vcheck.yga82jd.mongodb.net/vcheck?retryWrites=true&w=majority&appName=vcheck";

console.log('🔍 Testing MongoDB Atlas connection...');
console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected successfully to MongoDB Atlas!');
    return mongoose.connection.db.admin().listDatabases();
  })
  .then((result) => {
    console.log('📁 Databases:', result.databases.map(db => db.name).join(', '));
    console.log('📁 Current database:', mongoose.connection.db.databaseName);
    return mongoose.connection.db.collection('users').countDocuments();
  })
  .then((count) => {
    console.log('👥 Users in collection:', count);
    if (count > 0) {
      return mongoose.connection.db.collection('users').find({}).limit(5).toArray();
    }
    return [];
  })
  .then((users) => {
    if (users.length > 0) {
      console.log('\n📋 Users found:');
      users.forEach(u => {
        console.log(`  - Username: ${u.username} | Email: ${u.email} | Role: ${u.role} | Active: ${u.isActive}`);
      });
    } else {
      console.log('\n⚠️  No users found in database!');
      console.log('💡 You need to register a user first!');
    }
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    mongoose.connection.close();
    process.exit(1);
  });
