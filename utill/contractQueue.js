const Queue = require('bull');
const fs = require('fs/promises');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes } = require("firebase/storage");
const { db } = require('../utill/db');
const { processContract } = require("../jobs/mian");
const { createProducts } = require("./createProducts");
const { default: axios } = require('axios');

const contractQueue = new Queue('Contract', 'redis://127.0.0.1:6379');


const blockScans = {
    "polygonTestnet": "https://mumbai.polygonscan.com/address/",
    "polygonMainnet": "https://polygonscan.com/address/"
};

contractQueue.process(async function (job, done) {
    console.log(job.data);
    try {

        let contract = await getDoc(doc(db, "contracts", job.data.filename));
        if (!contract.exists()) throw new Error(`Error: contract ${job.data.filename} does not exist`);
        contract = contract.data();
        let admin = await getDoc(doc(db, "admins", `${job.data.user}.myshopify.com`));
        if (!admin.exists()) throw new Error(`Error: admin ${job.data.user} does not exist`);
        admin = admin.data();
        let userWallet = admin.wallet;

        const deployedData = await processContract({
            contract: contract,
            userWallet: userWallet,
            filename: job.data.filename
        }, job);
        await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
            ...deployedData,
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

        console.log("creating products");
        let tokenIds = deployedData.deployedTokens.map(x => x.tokenId);
        let variants = contract.tokens.map(x => ({
            title: x.title,
            image: `https://ipfs.io/ipfs/${x.image}`,
            number: x.number,
            price: x.price
        }));
        await createProducts({
            shop: `${job.data.user}.myshopify.com`,
            body_html: `<h2>${job.data.contractName}</h2>
                <h4>Contract Address: ${deployedData.contractAddress}</h4>
                <h4>link: <a herf="${blockScans[contract.blockchain]}${deployedData.contractAddress}" target="_blank">
                polygonScan</a></h4>`,
            title: job.data.contractName,
            tags: ["NFT"],
            variants: variants,
            tokenIds: tokenIds,
            total: tokenIds.length
        });
        console.log("done");

        job.progress(100);
        done();
    } catch (err) {
        console.log(err);
        done();
    }
});


exports.contractQueue = contractQueue;