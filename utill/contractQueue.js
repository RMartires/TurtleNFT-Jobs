const Queue = require('bull');
const fs = require('fs/promises');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes } = require("firebase/storage");
const { db } = require('../utill/db');
const { processContract } = require("../jobs/mian");

const contractQueue = new Queue('Contract', 'redis://127.0.0.1:6379');


const blockScans = {
    "polygonTestnet": "https://mumbai.polygonscan.com/address/",
    "polygonMainnet": "https://polygonscan.com/address/"
};

contractQueue.process(5, async function (job, done) {
    console.log(job.data);
    try {
        let contract = await getDoc(doc(db, "contracts", job.data.filename));
        if (!contract.exists()) throw new Error(`Error: contract ${job.data.filename} does not exist`);
        contract = contract.data();

        const deployedData = await processContract({
            contract: contract,
            filename: job.data.filename
        }, job);
        await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
            ...deployedData,
            deployedStatus: 'minted'
        });
        job.progress(50);

        const contractArtifact =
            await fs.readFile(`${__dirname}/../artifacts/contracts/${job.data.filename}.sol/${job.data.contractName}.json`);
        const storage = getStorage();
        const storageRef = ref(storage, `artifacts/${job.data.contractName}_${job.data.user}.json`);
        await new Promise((res, rej) => {
            uploadBytes(storageRef, contractArtifact).then((snapshot) => {
                res("Done");
            }).catch(err => {
                rej(err);
            });
        });

        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        console.log(err);
        done(new Error(err.message));
    }
});


exports.contractQueue = contractQueue;