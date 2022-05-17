const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");
const { db } = require("../utill/db");
const { Promise } = require('bluebird');
const { async } = require("@firebase/util");
const { ordersQueue } = require("../utill/ordersQueue");
// const axios = require('axios');
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

exports.fulfillmentNotification = async (req, res) => {
    try {
        const data = req.body;
        let shopData = req.get('x-shopify-shop-domain');
        const querySnapshot = await getDocs(query(collection(db, "admins"), where("shop", "==", shopData)));
        querySnapshot.forEach((doc) => {
            shopData = doc.data();
        });

        client = new Shopify.Clients.Rest(shopData.shop, shopData.accessToken);
        let re = null;

        let ValidOrders = [];

        if (data.kind = "FULFILLMENT_REQUEST") {
            re = await client.get({
                path: 'assigned_fulfillment_orders',
                query: { assignment_status: 'fulfillment_requested' }
            });

            let r = await Promise.map(re.body.fulfillment_orders, (data) => {
                return hasEmail({ line_items: data.line_items, fOrder: data });
            });
            await Promise.map(re.body.fulfillment_orders, async (order, odx) => {
                if (r[odx].hasEmail) {
                    ValidOrders.push({ ...r[odx].order, fulfillment_id: order.id });
                    await client.post({
                        path: `fulfillment_orders/${order.id}/fulfillment_request/accept`,
                        data: {
                            "fulfillment_request":
                                { "message": "Funggy is starting the fulfillment process." }
                        },
                        type: DataType.JSON
                    });
                } else {
                    await client.post({
                        path: `fulfillment_orders/${order.id}/fulfillment_request/reject`,
                        data: {
                            "fulfillment_request":
                                { "message": "Funggy cant start the fulfillment process, can't find a email in the order destination" }
                        },
                        type: DataType.JSON
                    });
                }
            });

            ValidOrders.forEach(order => {
                ordersQueue.add({
                    shop: req.get('x-shopify-shop-domain'),
                    att: 0,
                    items: order.line_items,
                    id: order.id,
                    fulfillment_id: order.fulfillment_id,
                    buyer: {
                        email: order.customer.email,
                        name: order.customer.first_name || "user"
                    }
                }, { delay: 10000 });
            });


        } else if (data.kind = "CANCELLATION_REQUEST") {
            re = await client.get({
                path: 'assigned_fulfillment_orders',
                query: { assignment_status: 'cancellation_request' }
            });

            await Promise.map(re.body.fulfillment_orders, async (order, odx) => {
                await client.post({
                    path: `fulfillment_orders/${order.id}/cancellation_request/reject`,
                    data: {
                        "cancellation_request":
                            { "message": "Funggy can't cancele this fullfillment right now" }
                    },
                    type: DataType.JSON
                });
            });
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            msg: 'done'
        });

    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            msg: err.message
        });
    }
}

const hasEmail = async (data) => {
    let variants = await Promise.map(data.line_items, async (item) => {
        let variant = await client.get({
            path: `variants/${item.variant_id}`,
        });
        return variant.body.variant;
    });

    let products = await Promise.map(variants, async (variant) => {
        let product = await client.get({
            path: `products/${variant.product_id}`,
        });
        return product.body.product;
    });

    let isNFT = !(products.filter(x => x.vendor !== "Funggy NFT Minter").length > 0);

    let re = await client.get({
        path: `orders/${data.fOrder.order_id}`
    });

    let hasEmail = re.body.order?.customer?.email || re.body.order?.email;

    return { hasEmail: hasEmail && isNFT, order: re.body.order };
};

exports.fetchStock = async (req, res) => {
    try {
        let tempJson = {};

        if (!req.query.sku) {
            let querySnapshot = await getDocs(query(
                collection(db, "contracts"),
                where("shop", "==", req.query.shop)
            ));

            querySnapshot.forEach((doc) => {
                let tempdata = doc.data();
                tempJson[tempdata.sku] = tempdata.inventory;
            });

        } else {
            let querySnapshot = await getDocs(query(
                collection(db, "contracts"),
                where("sku", "==", req.query.sku),
                where("shop", "==", req.query.shop)
            ));
            let tempDoc = null;
            querySnapshot.forEach((doc) => {
                tempDoc = doc.data();
            });

            tempJson[req.query.sku] = tempDoc.inventory;
        }


        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json(tempJson);

    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            msg: 'error'
        });
    }
}

exports.fetchTrackingNumbers = async (req, res) => {
    try {
        let tracking_numbers = {};

        await Promise(req.query.order_names, async (order_name) => {
            let querySnapshot = await getDocs(query(
                collection(db, "orders"),
                where("shop", "==", req.query.shop),
                where("order_name", "==", order_name)
            ));

            querySnapshot.forEach((doc) => {
                let tempdata = doc.data();
                if (tempdata.tokens && Array.isArray(tempdata.tokens))
                    tracking_numbers[order_name] = tempdata.tokens.map(x => x.hash);
            });
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            "tracking_numbers": tracking_numbers,
            "message": "Successfully received the tracking numbers",
            "success": true
        });
    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            msg: 'error'
        });
    }
}
