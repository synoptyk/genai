const mongoose = require('mongoose');
require('dotenv').config();
const PlatformUser = require('./platforms/auth/PlatformUser');
const { authorize } = require('./platforms/auth/authMiddleware');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  .then(async () => {
    try {
      console.log('Connected to DB');
      const users = await PlatformUser.find({}).lean();
      
      const middleware = authorize('admin_proyectos:ver');
      
      for (const user of users) {
        const req = { user };
        const res = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.data = data;
            return this;
          }
        };
        const next = () => {
          req.passed = true;
        };

        try {
          middleware(req, res, next);
          if (res.statusCode === 500) {
            console.error(`❌ User ${user.email} failed authorize with 500:`, res.data);
          }
        } catch (err) {
          console.error(`❌ User ${user.email} threw exception:`, err);
        }
      }
      console.log('Test completed.');
      process.exit(0);
    } catch(err) {
      console.error(err);
      process.exit(1);
    }
  });
