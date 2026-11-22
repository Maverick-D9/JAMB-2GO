// server/unified/unified.db.js
const mongoose = require("mongoose");

// Same cluster, different DB name = separate load, no extra cost
const URI = process.env.UNIFIED_MONGODB_URI || process.env.MONGODB_URI;

const unifiedConn = mongoose.createConnection(URI, {
  dbName: "jamb-2go-unified", // <-- NEW DB, not jamb-2go
});

module.exports = unifiedConn;
