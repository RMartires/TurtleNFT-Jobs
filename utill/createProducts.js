const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");
const { Promise } = require('bluebird');
const axios = require('axios');
const { db } = require('./db');

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



const uploadImage = async (client, data) => {
    // let response = await axios.get(data.src);
    // let baseData = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(response.data).toString('base64');
    // console.log(baseData);
    let r = await client.post({
        path: `products/${data.id}/images`,
        data: { "image": { "src": data.src } },
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

exports.createProducts = async (data) => {
    let shopData;
    const querySnapshot = await getDocs(query(collection(db, "admins"), where("shop", "==", data.shop)));
    querySnapshot.forEach((doc) => {
        shopData = doc.data();
    });

    let images = [];
    let tokenIds = data.tokenIds.map(x => `#${x}`);
    let variantDefaults = { "inventory_management": "shopify", "inventory_policy": "deny" }
    let variants = tokenIds.map(x => ({ ...variantDefaults, "option1": x }));
    let num = 0;
    data.variants.forEach((el, edx) => {
        for (let i = num; i < (el.number + num); i++) {
            let tempvar = { ...variants[i], price: el.price };
            variants[i] = tempvar;
            images.push({ image: el.image });
        }
        num += el.number;
    });

    const client = new Shopify.Clients.Rest(shopData.shop, shopData.accessToken);
    let product = await createProduct(client, {
        "body_html": data.body_html,
        "title": data.title,
        "vendor": "Turtle NFT",
        "product_type": "NFT",
        "tags": ["NFT", ...data.tags],
        "options": [
            {
                "name": "TokenID", "values": tokenIds
            }
        ],
        "variants": variants
    });

    images = images.map((x, xdx) => ({ ...x, id: product.body.product.variants[xdx].id }));

    let imageIDs = await Promise.map(images, (el) => {
        return uploadImage(client, {
            id: product.body.product.id,
            src: el.image
        });
    }, { concurrency: 5 });

    await Promise.map(product.body.product.variants.map((x, xdx) => ({ id: x.id, image_id: imageIDs[xdx] })), (data) => {
        return uploadVarientImage(client, {
            image_id: data.image_id,
            id: data.id
        });
    }, { concurrency: 5 });

    await Promise.map(product.body.product.variants.map(x => x.inventory_item_id), (item_id) => {
        return updateInventory(client, {
            item_id: item_id,
            number: 1
        });
    }, { concurrency: 5 });

    await updateDoc(doc(db, "contracts", data.contractDocName), {
        deployedStatus: 'minted'
    });

    return;
}
