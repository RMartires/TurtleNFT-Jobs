const Queue = require('bull');
const fs = require('fs/promises');
const axios = require("axios");
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes } = require("firebase/storage");
const { db } = require('../utill/db');
const { processContract } = require("../jobs/mian");
const { CreateProductService } = require('../controllers/products');
const { elrondIssueCollectionAndSetRole } = require("../utill/elrond/interactions");
const { account, provider, signer } = require("../utill/elrond/provider");

const contractQueue = new Queue('Contract', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});
const createProductQueue = new Queue('Product', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});

const ElrondTypes = {
    elrondMainet: 0,
    elrondTestnet: 1
}

const blockScans = {
    "polygonTestnet": "https://mumbai.polygonscan.com/address/",
    "polygonMainnet": "https://polygonscan.com/address/"
};

async function biconomySetup(data) {
    let r = await axios({
        url: 'https://api.biconomy.io/api/v1/smart-contract/public-api/addContract',
        method: "POST",
        headers: {
            authToken: process.env.BICONIMY_DASH_KEY,
            apiKey: process.env.BICONIMY_API_KEY
        },
        data: {
            contractName: data.contractName,
            contractAddress: data.contractAddress,
            abi: JSON.stringify(data.CA.abi),
            contractType: "SC",
            metaTransactionType: "TRUSTED_FORWARDER"
        }
    });

    console.log(r.data);

    r = await axios({
        url: 'https://api.biconomy.io/api/v1/meta-api/public-api/addMethod',
        method: "POST",
        headers: {
            authToken: process.env.BICONIMY_DASH_KEY,
            apiKey: process.env.BICONIMY_API_KEY
        },
        data: {
            apiType: "native",
            methodType: "write",
            name: data.filename,
            contractAddress: data.contractAddress,
            method: "createNFT"
        }
    });

    console.log(r.data);
}

contractQueue.process(5, async function (job, done) {
    console.log(job.data);
    try {
        let contract = await getDoc(doc(db, "contracts", job.data.filename));
        if (!contract.exists()) throw new Error(`Error: contract ${job.data.filename} does not exist`);
        contract = contract.data();

        // if (contract.deployedStatus == "published") throw new Error("Error: this contract is already published");

        if (contract.blockchain.includes("elrond")) {

            const dataForCollection = {
                ipfsPath: "pinata",
                collectionName: contract.contractName,
                collectionTicker: "TEST",//?
                networkType: ElrondTypes[contract.blockchain]
            }

            const collectionId = await elrondIssueCollectionAndSetRole(account, signer, provider, dataForCollection.collectionName, dataForCollection.collectionTicker, ElrondTypes.Testnet);

            job.progress(50);

            await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
                contractAddress: collectionId,
            });

        } else {

            const deployedData = await processContract({
                contract: contract,
                filename: job.data.filename
            }, job);

            job.progress(50);

            await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
                ...deployedData,
            });

            const contractArtifact =
                await fs.readFile(`${__dirname}/../artifacts/contracts/${job.data.filename}.sol/${job.data.contractName}.json`);

            if (contract.biconomy) {
                await biconomySetup({
                    CA: JSON.parse(contractArtifact.toString()),
                    contractAddress: deployedData.contractAddress,
                    filename: job.data.filename,
                    contractName: contract.contractName,
                });
            }

            const storage = getStorage();
            const storageRef = ref(storage, `artifacts/${job.data.contractName}_${job.data.user}.json`);
            await new Promise((res, rej) => {
                uploadBytes(storageRef, contractArtifact).then((snapshot) => {
                    res("Done");
                }).catch(err => {
                    rej(err);
                });
            });
            await fs.rm(`${__dirname}/../artifacts/contracts/${job.data.filename}.sol`, { recursive: true });

        }

        createProductQueue.add(job.data, { attempts: 2 });

        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        if (err.message == "HH600: Compilation failed") {
            await fs.unlink(`${__dirname}/../contracts/${job.data.filename}.sol`);
        }
        if (job.attemptsMade === 4) {
            await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
                deployedStatus: 'failed'
            });
        }
        console.log(err);
        done(new Error(err.message));

    }
});

createProductQueue.process(5, async function (job, done) {
    try {
        await CreateProductService(job.data.user, `${job.data.contractName}_${job.data.user}`);

        await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
            deployedStatus: 'published'
        });

        job.progress(50);

        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        if (job.attemptsMade === 1) {
            await updateDoc(doc(db, "contracts", `${job.data.contractName}_${job.data.user}`), {
                deployedStatus: 'shopify-failed',
                shopifyerror: err.message
            });
        }
        console.log(err);
        done(err);
    }
});


exports.contractQueue = contractQueue;
exports.createProductQueue = createProductQueue;