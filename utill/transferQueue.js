const Queue = require('bull');
const axios = require('axios');
const ethers = require('ethers');
const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { Promise } = require('bluebird');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, getDownloadURL } = require("firebase/storage");
const config = require('../jobs/utill/config.json');
const { db } = require('../utill/db');
const { pinJSON } = require('../jobs/utill/pinJSON');

Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
    API_VERSION: ApiVersion.October20,
    IS_EMBEDDED_APP: true,
    // This should be replaced with your preferred storage strategy
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

const transferQueue = new Queue('Transfer', 'redis://127.0.0.1:6379');

const gasStation = {
    "polygonMainnet": 'https://gasstation-mainnet.matic.network/',
    "polygonTestnet": 'https://gasstation-mumbai.matic.today/'
};

const blockchainScans = {
    "polygonMainnet": "https://polygonscan.com/tx/",
    "polygonTestnet": "https://mumbai.polygonscan.com/tx/"
};

transferQueue.process(async function (job, done) {
    console.log(job.data);
    try {
        let order = await getDoc(doc(db, "orders", job.data.orderId));
        if (!order.exists()) throw new Error(`Error: contract ${job.data.orderId} does not exist`);
        order = order.data();

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


        let txs = await Promise.map(order.tokens, async (token, tdx) => {
            let abi = files[tdx].data.abi;
            let provider = new ethers.providers.JsonRpcProvider({ url: config[token.blockchain] });
            let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            let contractInstance = new ethers.Contract(token.contractAddress, abi, wallet);
            console.log(order.buyerWallet, ipfsArr[tdx]);

            let r1 = await axios.get(gasStation[token.blockchain]);
            let gasPrice = r1.data['fast'] * 1000000000;

            let tx = await contractInstance["createNFT(address,string)"](order.buyerWallet, ipfsArr[tdx],
                { gasPrice: ethers.BigNumber.from(gasPrice) });

            let tokenID = await new Promise((res, rej) => {
                contractInstance.on("ValueChanged", (author, newValue, event) => {
                    res(parseInt(newValue._hex));
                });
            });
            job.log(`minted: ${tokenID} ${tx.hash}`);
            return { tx: tx, tokenID: tokenID };
        }, { concurrency: 1 });

        await updateDoc(doc(db, "orders", job.data.orderId), {
            tokens: order.tokens.map((x, xdx) => ({ ...x, hash: txs[xdx].tx.hash, tokenId: txs[xdx].tokenID })),
            progress: 'transfered'
        });

        // let txs = order.tokens;
        let admin = await getDoc(doc(db, "admins", order.shop));
        admin = admin.data();
        let TrackingNumbers = txs.map((tx) => tx.tx.hash);
        let TrackingURLs = txs.map((tx, idx) => `${blockchainScans[order.tokens[idx].blockchain]}${tx.tx.hash}`);
        await updateFulfillment(admin, order.orderId, { TrackingNumbers, TrackingURLs });

        job.progress(100);

        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        console.log(err);
        done(new Error(err.message));
    }
});


async function updateFulfillment(admin, orderId, data) {
    // console.log(data);
    const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
    const fullData = await client.get({
        path: `orders/${orderId}/fulfillments`,
    });
    let fulfillmentId = fullData.body.fulfillments[0].id;
    let locationId = fullData.body.fulfillments[0].location_id;
    await client.post({
        path: `fulfillments/${fulfillmentId}/cancel`,
        data: {},
        type: DataType.JSON,
    });

    await client.post({
        path: `orders/${orderId}/fulfillments`,
        data: {
            "fulfillment": {
                "location_id": locationId,
                "tracking_numbers": data.TrackingNumbers,
                "tracking_urls": data.TrackingURLs,
                "notify_customer": true
            }
        },
        type: DataType.JSON,
    });

    return;
}


exports.transferQueue = transferQueue;