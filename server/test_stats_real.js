const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/bot/produccion-stats',
  method: 'GET',
  headers: {
    // We need a valid token to access this.
    // Wait, the API requires protect middleware.
  }
};
// I can't easily mock auth. Let me just test locally with Mongoose.
