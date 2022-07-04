const Queue = require('bull');
const axios = require('axios');
const ethers = require('ethers');
const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { Promise } = require('bluebird');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, getDownloadURL } = require("firebase/storage");
const config = require('../jobs/utill/config.json');
const { db } = require('../utill/db');
const { pinJSON, pinFile } = require('../jobs/utill/pinJSON');
const { mintAndTransfer } = require("../utill/elrond/interactions");
const { account, provider, signer } = require("../utill/elrond/provider");

Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
    API_VERSION: ApiVersion.October21,
    IS_EMBEDDED_APP: true,
    // This should be replaced with your preferred storage strategy
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

const transferQueue = new Queue('Transfer', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});

const gasStation = {
    "polygonMainnet": 'https://gasstation-mainnet.matic.network/',
    "polygonTestnet": 'https://gasstation-mumbai.matic.today/'
};

const blockchainScans = {
    "polygonMainnet": "https://polygonscan.com/tx/",
    "polygonTestnet": "https://mumbai.polygonscan.com/tx/",
    "elrondTestnet": "https://testnet-explorer.elrond.com/transactions/",
    "elrondMainnet": "",
};

transferQueue.process(5, async function (job, done) {
    console.log(job.data);
    try {
        let txs = null;
        let order = await getDoc(doc(db, "orders", job.data.orderId));
        if (!order.exists()) throw new Error(`Error: contract ${job.data.orderId} does not exist`);
        order = order.data();

        if (order.tokens[0].blockchain.includes("elrond")) {

            txs = await Promise.map(order.tokens, async (token, tdx) => {
                const dataForClaiming = {
                    receiver: 'erd15936k9pw34xyzmcaupyn7lpr7f6p20q50h4wlgemxg7h9zasdfysmhg50z',
                    collectionId: token.contractAddress,
                    collectionName: token.contractName,
                    image: token.tokenMeta.image
                }

                let data = await mintAndTransfer(account, signer, provider,
                    dataForClaiming.collectionId,
                    dataForClaiming.receiver, dataForClaiming.image, token.blockchain);

                return { tx: { hash: data.tx }, tokenID: `${token.contractAddress}-${data.nonce}`, blockchain: token.blockchain };
            }, { concurrency: 1 });

        } else {

            const storage = getStorage();
            const ABI_URLs = await Promise.map(order.tokens, (token) => {
                return getDownloadURL(ref(storage, `artifacts/${token.contractName}_${token.shop.split(".")[0]}.json`));
            });
            const files = await Promise.map(ABI_URLs, (url) => {
                return axios({
                    method: 'get',
                    url: url
                });
            });

            job.progress(33);


            let ipfsArr = await Promise.map(order.tokens, (token) => {
                return pinJSON({
                    filename: token.filename,
                    data: token.tokenMeta
                });
            });

            job.progress(50);

            let nonce = null;
            let updatedTokens = order.tokens;
            let tx = null;
            let tokenID = null;


            txs = await Promise.map(order.tokens, async (token, tdx) => {

                let hash = ipfsArr[tdx];
                let URI = `https://ipfs.io/ipfs/${hash}`;
                let mintArgs = [order.buyerWallet, URI];
                let mintFunction = "createNFT(address,string)";


                if (token.type == "genArtContract") {
                    mintFunction = "createNFT(address,string,uint256)";
                    let args = await genArtContractSetup(token);
                    mintArgs = [order.buyerWallet, ...args];
                } else if (token.type == "multi-asset") {
                    mintFunction = "createNFT(address,string,uint256)";
                    let args = [URI, token.RandomId];
                    mintArgs = [order.buyerWallet, ...args];
                }

                let abi = files[tdx].data.abi;
                let provider = new ethers.providers.JsonRpcProvider({ url: config[token.blockchain] });
                if (tdx == 0)
                    nonce = await provider.getTransactionCount(process.env.Public_KEY);
                console.log(nonce);

                let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                let contractInstance = new ethers.Contract(token.contractAddress, abi, wallet);

                console.log(mintArgs);
                let r1 = await axios.get(gasStation[token.blockchain]);
                let gasPrice = r1.data['fast'] * 1000000000;


                if (updatedTokens[tdx].status != "minted") {
                    tx = await contractInstance[mintFunction](...mintArgs,
                        {
                            gasPrice: ethers.BigNumber.from(gasPrice),
                            nonce: nonce
                        });

                    tokenID = await new Promise((res, rej) => {
                        contractInstance.on("ValueChanged", (author, newValue, event) => {
                            res(parseInt(newValue._hex));
                        });
                    });

                    updatedTokens[tdx].status = "minted";
                    await updateDoc(doc(db, "orders", job.data.orderId), {
                        tokens: updatedTokens,
                    });

                    nonce += 1;
                }

                job.log(`minted: ${tokenID} ${tx.hash}`);
                provider.polling = false;
                return { tx: tx, tokenID: tokenID, blockchain: token.blockchain };

            }, { concurrency: 1 });

        }

        await updateDoc(doc(db, "orders", job.data.orderId), {
            tokens: order.tokens.map((x, xdx) => ({ ...x, hash: txs[xdx].tx.hash, tokenId: txs[xdx].tokenID })),
            progress: 'transfered',
            TrackingNumbers: txs.map((tx) => tx.tx.hash)
        });

        let TrackingInfo = txs.map((tx) => ({
            number: tx.tx.hash,
            url: `${blockchainScans[tx.blockchain]}${tx.tx.hash}`,
            company: 'Funggy NFT Minter'
        }));

        // let txs = order.tokens;
        let admin = await getDoc(doc(db, "admins", order.shop));
        admin = admin.data();

        let fulfillData = await CreateFulfillment(admin, order.fulfillmentOrder_id, TrackingInfo);
        await updateDoc(doc(db, "orders", job.data.orderId), {
            ...fulfillData
        });

        job.progress(100);

        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        await updateDoc(doc(db, "orders", job.data.orderId), {
            progress: 'failed',
        });
        job.log(err);
        console.log(err);
        done(new Error(err.message));
    }
});


async function CreateFulfillment(admin, fulfillmentOrder_id, TrackingInfo) {
    const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
    let full = await client.post({
        path: 'fulfillments',
        data: {
            fulfillment: {
                message: "NFT transfered",
                notify_customer: true,
                line_items_by_fulfillment_order: [
                    {
                        fulfillment_order_id: fulfillmentOrder_id,
                    }
                ],
                tracking_info: TrackingInfo[0],
                tracking_urls: TrackingInfo.map(x => x.url),
                tracking_numbers: TrackingInfo.map(x => x.number),
                status: "success",
                shipment_status: 'delivered'
            }
        },
        type: DataType.JSON
    });

    return { fulfillment_name: full.body.fulfillment.name };
}

async function genArtContractSetup(token) {
    let shop = token.shop.split(".")[0];

    const storage = getStorage();
    let storageRef = ref(storage, `users/${shop}/${token.contractName}/images/${token.RandomId}.png`);
    let url = await getDownloadURL(storageRef);
    let filename = `${token.contractName}#${token.RandomId}`;
    let Imagehash = await pinFile({ image_url: url, name: filename });

    storageRef = ref(storage, `users/${shop}/${token.contractName}/json/${token.RandomId}.json`);
    url = await getDownloadURL(storageRef);
    let tokenMeta = await axios.get(url);
    tokenMeta = tokenMeta.data;
    tokenMeta.image = `https://ipfs.io/ipfs/${Imagehash}`;

    let hash = await pinJSON({
        filename: filename,
        data: tokenMeta
    });

    let URI = `https://ipfs.io/ipfs/${hash}`;

    return [URI, token.RandomId];
}

exports.transferQueue = transferQueue;
exports.CreateFulfillment = CreateFulfillment;