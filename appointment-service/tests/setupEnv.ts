process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
// "localhost" resolves to the IPv6 loopback first on some setups, where
// mongod/Docker's port mapping doesn't listen - the IPv4 literal avoids a
// slow (or on single-node replica sets, outright failing) DNS/connect path.
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/randevia_appointment_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
