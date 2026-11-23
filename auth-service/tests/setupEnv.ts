process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
// "localhost" resolves to the IPv6 loopback first on some setups, where
// mongod/Docker's port mapping doesn't listen - the IPv4 literal avoids a
// slow (or outright failing) DNS/connect path.
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/randevia_auth_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-service-token';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
