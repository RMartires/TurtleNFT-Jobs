const Queue = require('bull');
const fs = require('fs/promises');
const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { doc, getDoc, updateDoc, setDoc, increment } = require("firebase/firestore");
const { getStorage, ref, uploadBytes } = require("firebase/storage");
const { Promise } = require("bluebird");
const generator = require("generate-password");
const { v4 } = require("uuid");
const axios = require("axios");
const { db } = require('../utill/db');

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


const ordersQueue = new Queue('Orders', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});

ordersQueue.process(async function (job, done) {
    try {
        console.log(job.id, job.data.att, new Date());
        let admin = await getDoc(doc(db, "admins", job.data.shop));
        admin = admin.data();

        let basePath = "https://tophatturtle.in/nft";
        if (admin?.claim?.type == "custom")
            basePath = admin.claim.basePath;

        let fulfillmentOrder = job.data.fulfillmentOrder;

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
                att: (job.data.att + 1),
                buyer: job.data.buyer
            }, { delay: job.data.att > 5 ? (60000 * 3) : 30000 }); // 3 mins or 30 secs
            done();
            return null;
        } else {
            if (risks[0].recommendation == 'accept') {
                const orderData = await createOrder(job.data, job.data.id, null);
                await axios({
                    method: 'POST',
                    url: `${process.env.FUNCTIONS}/sendOrderEmail`,
                    data: {
                        buyer: job.data.buyer,
                        order: {
                            shop: job.data.shop,
                            link: `${basePath}?id=${orderData.UUID}`,
                            password: orderData.password
                        }
                    }
                });

            } else {
                const orderData = await createOrder(job.data, job.data.id, "manual");
                const ShopData = await client.get({
                    path: 'shop',
                    query: { "fields": "email,shop_owner" },
                });
                await axios({
                    method: 'POST',
                    url: `${process.env.FUNCTIONS}/sendRiskAlertEmail`,
                    data: {
                        shop: {
                            shop: job.data.shop,
                            name: ShopData.body.shop.shop_owner,
                            email: ShopData.body.shop.email
                        }
                    }
                });
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

async function createOrder(jobData, orderId, orderStatus) {
    let items = [];
    let shop = jobData.shop;
    let buyer = jobData.buyer;
    let fulfillmentOrder_id = jobData.fulfillmentOrder.id;
    let RandomId = null;

    jobData.items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            items.push(item);
        }
    });

    let contracts = await Promise.map(items, async (item) => {
        let contract = await getDoc(doc(db, "contracts", `${item.title}_${shop.split(".")[0]}`));
        contract = contract.data();
        if (contract?.type == "genArtContract") {
            var index = Math.floor(Math.random() * contract.IdsToMint.length);
            let newIdsToMint = [...contract.IdsToMint];
            RandomId = newIdsToMint.splice(index, 1)[0];
            await updateDoc(doc(db, "contracts", `${item.title}_${shop.split(".")[0]}`), {
                IdsToMint: newIdsToMint
            });
            contract.RandomId = RandomId;
        } else if (contract?.type == "multi-asset") {
            var index = Math.floor(Math.random() * contract.tokensToMint.length);
            let newTokensToMint = [...contract.tokensToMint];
            let RandomToken = newTokensToMint.splice(index, 1)[0];
            console.log(RandomToken, buyer);
            await updateDoc(doc(db, "contracts", `${item.title}_${shop.split(".")[0]}`), {
                tokensToMint: newTokensToMint
            });
            contract.RandomId = RandomToken.Id;
            contract.RandomToken = RandomToken;
        }
        return contract;
    });
    let newItems = [];
    items.forEach((item, idx) => {
        let token = contracts[idx].tokenToMint;
        if (contracts[idx]?.type == "multi-asset")
            token = contracts[idx].RandomToken;
        newItems.push({
            name: item.name,
            price: item.price,
            tokenMeta: token.metaData,
            filename: token.filename,
            contractAddress: contracts[idx].contractAddress,
            contractName: contracts[idx].contractName,
            shop: contracts[idx].shop,
            blockchain: contracts[idx].blockchain,
            RandomId: contracts[idx].RandomId || false,
            type: contracts[idx]?.type || false,
            biconomy: contracts[idx]?.biconomy || false,
        });
    });
    let UUID = v4();
    let password = generator.generate({
        length: 10,
        numbers: true
    });
    console.log({
        orderId: orderId,
        tokens: newItems,
        uuid: UUID,
        password: password,
        shop: shop,
        progress: orderStatus,
        buyer: buyer,
        fulfillmentOrder_id: fulfillmentOrder_id,
    });
    await setDoc(doc(db, "orders", `${UUID}`), {
        orderId: orderId,
        tokens: newItems,
        uuid: UUID,
        password: password,
        shop: shop,
        progress: orderStatus,
        buyer: buyer,
        fulfillmentOrder_id: fulfillmentOrder_id,
        createdAt: new Date()
    });

    await Promise.map(items, async (item) => {
        let contract = await getDoc(doc(db, "contracts", `${item.title}_${shop.split(".")[0]}`));
        contract = contract.data();
        await updateDoc(doc(db, "contracts", `${item.title}_${shop.split(".")[0]}`), {
            inventory: increment(-1)
        });
        return;
    });

    return { UUID: UUID, password: password };
}

exports.ordersQueue = ordersQueue;