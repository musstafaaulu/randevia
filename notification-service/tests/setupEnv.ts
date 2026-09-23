process.env.NODE_ENV = 'test';
process.env.PORT = '4002';
process.env.MONGO_URI = 'mongodb://localhost:27017/randevia_notification_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
// Isolated from the dev topology so tests never consume real events.
process.env.RABBITMQ_EXCHANGE = 'randevia.events.test';
process.env.NOTIFICATION_QUEUE = 'notification-service.test.appointment-events';
process.env.MESSAGE_MAX_RETRIES = '2';
process.env.MESSAGE_RETRY_DELAY_MS = '100';
