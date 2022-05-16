const { collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");
const { db } = require("../utill/db");
const { Promise } = require('bluebird');
const { async } = require("@firebase/util");
// const axios = require('axios');
// Shopify.Context.initialize({
//     API_KEY: process.env.SHOPIFY_API_KEY,
//     API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
//     SCOPES: process.env.SCOPES.split(","),
//     HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
//     API_VERSION: ApiVersion.October21,
//     IS_EMBEDDED_APP: true,
//     // This should be replaced with your preferred storage strategy
//     SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
// });

exports.fulfillmentNotification = async (req, res) => {
    try {
        console.log("/fulfillmentNotification");
        console.log(req.body);
        if (req.body.kind == "FULFILLMENT_REQUEST") {


        } else if (req.body.kind == "CANCELLATION_REQUEST") {

        }


        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            msg: err.message
        });
    } catch (err) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            msg: err.message
        });
    }
}

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
