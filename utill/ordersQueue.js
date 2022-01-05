const Queue = require('bull');
const fs = require('fs/promises');
const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { doc, getDoc, updateDoc, setDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes } = require("firebase/storage");
const { Promise } = require("bluebird");
const generator = require("generate-password");
const { v4 } = require("uuid");
const { db } = require('../utill/db');

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


const ordersQueue = new Queue('Orders', 'redis://127.0.0.1:6379');

ordersQueue.process(async function (job, done) {
    try {
        console.log(job.id, job.data.att, new Date());
        let admin = await getDoc(doc(db, "admins", job.data.shop));
        admin = admin.data();

        console.log(admin);
        const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
        let risks = await retryGETRisk(client, job);
        console.log(risks);
        risks = [{ recommendation: 'accept' }];
        if (!risks.length > 0) {
            console.log("retying...");
            ordersQueue.add({
                items: job.data.items,
                id: job.data.id,
                shop: job.data.shop,
                att: (job.data.att + 1)
            }, { delay: job.data.att > 5 ? (60000 * 3) : 30000 }); // 3 mins or 30 secs
            done();
            return null;
        } else {
            if (risks[0].recommendation == 'accept') {
                await createOrder(job.data.items, job.data.shop, job.data.id);
            } else {
                //manual fullfill
            }
            done();
        }
    } catch (err) {
        done(new Error(err.message));
        console.log(err);
    }
});

async function retryGETRisk(client, job) {
    const data = await client.get({
        path: `orders/${job.data.id}/risks`,
    });
    let risks = data.body.risks;
    return risks;
}

async function createOrder(items, shop, orderId) {
    let contracts = await Promise.map(items, (item) => {
        return getDoc(doc(db, "contracts", `${item.title}_${shop.split(".")[0]}`));
    });
    contracts = contracts.map(con => con.data());
    let newItems = [];
    items.forEach((item, idx) => {
        let token = contracts[idx].tokensToMint.filter(x => `#${x.tokenId}` == item.variant_title)[0];
        newItems.push({
            name: item.name,
            price: item.price,
            tokenMeta: token.metaData,
            filename: token.filename,
            contractAddress: contracts[idx].contractAddress,
            tokenId: token.tokenId,
            contractName: contracts[idx].contractName,
            shop: contracts[idx].shop,
            blockchain: contracts[idx].blockchain
        });
    });
    let UUID = v4();
    let password = generator.generate({
        length: 10,
        numbers: true
    });
    await setDoc(doc(db, "orders", `${UUID}`), {
        orderId: orderId,
        tokens: newItems,
        uuid: UUID,
        password: password,
        shop: shop
    });
    return;
}

exports.ordersQueue = ordersQueue;