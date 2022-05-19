var express = require('express');
var router = express.Router();

const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { db } = require('../utill/db');
const { MWCustomerData, MWCustomerErasure, MWShopErasure } = require("../controllers/mondatory");
const { fulfillmentNotification, fetchStock, fetchTrackingNumbers } = require("../controllers/fulfillment");
const { uninstall } = require("../controllers/uninstall");
const { CreateProduct } = require("../controllers/products");
const { ChangePlan } = require("../controllers/plans");
const { ordersQueue } = require("../utill/ordersQueue");
const { contractQueue } = require('../utill/contractQueue');
const { transferQueue } = require('../utill/transferQueue');
const { genArtQueue } = require('../utill/genArtQueue');
const { LazyTxQueue } = require('../utill/customQueues');


/* GET home page. */
router.get('/processContract', async function (req, res) {
  try {
    console.log(req.query);
    contractQueue.add(req.query, {
      attempts: 5,
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      msg: 'error'
    });
  }
});


router.post('/ordersCreate', async function (req, res) {
  try {
    if (!req.auth) throw new Error("Unauthorized");
    let isNFT;
    let NFTItems = [];
    console.log(req.body);
    req.body.line_items.forEach(item => {
      if (item.vendor = "Turtle NFT") {
        NFTItems.push(item);
        isNFT = true;
      }
    });
    if (isNFT) {
      ordersQueue.add({
        items: NFTItems,
        id: req.body.id,
        shop: req.headers["x-shopify-shop-domain"],
        att: 0,
        buyer: {
          email: req.body.email || req.body.contact_email,
          name: req.body.shipping_address?.name || "user"
        }
      }, { delay: 10000 });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    if (err.message == "Unauthorized") {
      res.status(401).json({
        msg: 'Unauthorized'
      });
    } else {
      res.status(500).json({
        msg: 'error'
      });
    }
  }
});

router.post('/uninstall', uninstall);
// router.post('/PlanChange', PlanChangeWH);
router.post('/MWCustomerData', MWCustomerData);
router.post('/MWCustomerErasure', MWCustomerErasure);
router.post('/MWShopErasure', MWShopErasure);

router.get('/CreateProduct', CreateProduct);
router.get('/ChangePlan', ChangePlan);

router.get('/transfer', async function (req, res) {
  try {
    let order = await getDoc(doc(db, "orders", req.query.orderId));
    order = order.data();

    if (order.shop == "temp.myshopify.com") {
      LazyTxQueue.add({
        ...req.query
      }, {
        attempts: 1,
      });
    } else {
      transferQueue.add({
        ...req.query
      }, {
        attempts: 1,
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });

  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      msg: err.message
    });
  }
});

router.get('/gen-art', async function (req, res) {
  try {
    console.log(req.query);
    genArtQueue.add(req.query);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      msg: 'error'
    });
  }
});

router.post('/fulfillment_service/fulfillment_order_notification', fulfillmentNotification);

router.get('/fulfillment_service/fetch_stock.json', fetchStock);
router.get('/fulfillment_service/fetch_tracking_numbers.json', fetchTrackingNumbers);


module.exports = router;