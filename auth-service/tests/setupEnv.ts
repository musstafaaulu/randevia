process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGO_URI = 'mongodb://localhost:27017/randevia_auth_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
