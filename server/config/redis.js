const {createClient} = require('redis');    

const client = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

client.connect();
client.on('error', (err) => {
    console.error('Redis Client Error', err); 
});

client.on('ready', async () => {
    console.log('Redis client Ready');
});

module.exports = client;
