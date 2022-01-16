const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");
const { Promise } = require('bluebird');
const axios = require('axios');
const { db } = require('./db');
var { retryOperation } = require('./promiseRetry');

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

const updateInventory = async (client, data) => {
    let locations = await client.get({
        path: 'locations',
    });
    await client.post({
        path: 'inventory_levels/set',
        data: {
            "location_id": locations.body.locations[0].id,
            "inventory_item_id": data.item_id,
            "available": data.number
        },
        type: DataType.JSON,
    });
    return;
};

const createProduct = async (client, data) => {
    let r = await client.post({
        path: 'products',
        data: {
            product: data
        },
        type: DataType.JSON,
    });
    return r;
};

exports.createProducts = async (data) => {
    let shopData;
    const querySnapshot = await getDocs(query(collection(db, "admins"), where("shop", "==", data.shop)));
    querySnapshot.forEach((doc) => {
        shopData = doc.data();
    });

    let variantDefaults = { "inventory_management": "shopify", "inventory_policy": "deny" };

    const client = new Shopify.Clients.Rest(shopData.shop, shopData.accessToken);
    let r = await createProduct(client, {
        "body_html": data.body_html,
        "title": data.title,
        "vendor": "Turtle NFT",
        "product_type": "NFT",
        "tags": ["NFT", ...data.tags],
    });
    await client.post({
        path: `products/${r.body.product.id}/images`,
        data: { "image": { attachment: data.image64 } },
        type: DataType.JSON,
    });

    let variant = r.body.product.variants[0];
    r = await client.put({
        path: `variants/${variant.id}`,
        data: {
            "variant": {
                "id": variant.id,
                ...variantDefaults,
                price: data.price
            }
        },
        type: DataType.JSON,
    });

    let inventory_item_id = r.body.variant.inventory_item_id;
    await updateInventory(client, { item_id: inventory_item_id, number: data.supply });
    await updateDoc(doc(db, "contracts", data.contractDocName), {
        deployedStatus: 'published'
    });

    return;
}

const uploadImage = async (client, data) => {
    let r = await client.post({
        path: `products/${data.id}/images`,
        data: { "image": { src: data.src } },
        type: DataType.JSON,
    });
    return r.body.image.id;
};
const uploadVarientImage = async (client, data) => {
    let r = await client.put({
        path: `variants/${data.id}`,
        data: { "variant": { "id": data.id, "image_id": data.image_id } },
        type: DataType.JSON,
    });
    return;
};

const createVarient = async (client, data) => {
    let r = await client.post({
        path: `products/${data.id}/variants`,
        data: {
            "variant": {
                "image_id": data.image_id,
                "option1": "tokenId",
                "tokenId": "1",
                "price": data.price
            }
        },
        type: DataType.JSON,
    });
    return r;
};
