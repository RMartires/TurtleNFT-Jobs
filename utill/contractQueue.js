const Queue = require('bull');
const fs = require('fs/promises');
const { doc, setDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes } = require("firebase/storage");
const { db } = require('../utill/db');
const { processContract } = require("../jobs/mian");

const contractQueue = new Queue('Contract', 'redis://127.0.0.1:6379');

contractQueue.process(async function (job, done) {
    console.log(job.data);
    try {
        const contractAddress = await processContract(job.data);
        await setDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
            ...job.data,
            contractAddress: contractAddress,
        });

        const contractArtifact =
            await fs.readFile(`${__dirname}/../artifacts/contracts/${job.data.filename}.sol/${job.data.contractName}.json`);
        const storage = getStorage();
        const storageRef = ref(storage, `artifacts/${job.data.contractName}.json`);
        await new Promise((res, rej) => {
            uploadBytes(storageRef, contractArtifact).then((snapshot) => {
                res("Done");
            }).catch(err => {
                rej(err);
            });
        });

        done();
    } catch (err) {
        console.log(err);
        done();
    }
});

exports.contractQueue = contractQueue;