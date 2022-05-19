const Queue = require('bull');
const genArtQueue = new Queue('GenArt', 'redis://127.0.0.1:6379');

genArtQueue.process(`${__dirname}/genArtProcessor.js`);

exports.genArtQueue = genArtQueue;