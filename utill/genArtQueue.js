const { doc, getDoc, updateDoc } = require("firebase/firestore");
const Queue = require('bull');
let { db } = require('./db');
const genArtQueue = new Queue('GenArt', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});

genArtQueue.process(`${__dirname}/genArtProcessor.js`);

genArtQueue.on('global:failed', async (jobId, err) => {
    let job = await genArtQueue.getJob(jobId);
    await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
        deployedStatus: 'failed'
    });
});

exports.genArtQueue = genArtQueue;