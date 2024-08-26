const {createClient} = require('redis');    

const client = createClient();

client.connect();
client.on('error', (err) => {
    console.error('Redis Client Error', err); 
});

client.on('ready', async () => {
    console.log('Redis client Ready');
    try {
        await client.flushAll();
        console.log('All keys have been flushed');
    } catch (err) {
        console.error('Error flushing all keys:', err);
    }
});

module.exports = client;
