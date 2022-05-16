// import { FulfillmentService } from '@shopify/shopify-api/dist/rest-resources/2022-04/index.js';
// const { collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");
// const { Promise } = require('bluebird');
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