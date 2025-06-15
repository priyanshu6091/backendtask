// Create this file to enable using the database adapter
require('dotenv').config();
const db = require('./adapter');

// Export the adapter for use in index.js
module.exports = db;
