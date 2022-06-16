var express = require('express');
var router = express.Router();

const axios = require('axios');
const { doc, getDoc, updateDoc, setDoc } = require("firebase/firestore");
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { db } = require('../utill/db');
const { pinJSON } = require('../jobs/utill/pinJSON');
const { MWCustomerData, MWCustomerErasure, MWShopErasure } = require("../controllers/mondatory");
const { fulfillmentNotification, fetchStock, fetchTrackingNumbers } = require("../controllers/fulfillment");
const { uninstall } = require("../controllers/uninstall");
const { CreateProduct } = require("../controllers/products");
const { ChangePlan } = require("../controllers/plans");
const { sendOrderEmail } = require("../controllers/sendOrderEmail");
const { ordersQueue } = require("../utill/ordersQueue");
const { contractQueue } = require('../utill/contractQueue');
const { transferQueue, CreateFulfillment } = require('../utill/transferQueue');
const { genArtQueue } = require('../utill/genArtQueue');
const { LazyTxQueue } = require('../utill/customQueues');

const blockchainScans = {
  "polygonMainnet": "https://polygonscan.com/tx/",
  "polygonTestnet": "https://mumbai.polygonscan.com/tx/"
};


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

router.get('/getOrder', async function (req, res) {
  try {
    console.log(req.query);
    let order = await getDoc(doc(db, "orders", req.query.orderId));
    order = order.data();

    let login = false;
    if (order.password == req.query.password) {
      login = order;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(200).json({
      msg: "done",
      orderData: login
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(500).json({
      msg: 'error'
    });
  }
});

router.post('/getTokenData', async function (req, res) {
  try {

    const storage = getStorage();
    const storageRef = ref(storage, `artifacts/${req.body.contractName}_${req.body.user}.json`);
    const download_url = await getDownloadURL(storageRef);
    let data = await axios.get(download_url);
    let abi = data.data.abi;

    let hash = await pinJSON({
      filename: req.body.token.filename,
      data: req.body.token.metaData
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(200).json({
      msg: "done",
      data: {
        url: `https://ipfs.io/ipfs/${hash}`,
        abi
      }
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(500).json({
      msg: 'error'
    });
  }
});

router.post('/setToken', async function (req, res) {
  try {

    let order = await getDoc(doc(db, "orders", req.body.orderId));
    order = order.data();

    let tokens = order.tokens;
    let token = tokens[req.body.index];
    token.tx = req.body.hash;

    tokens[req.body.index] = token;

    await setDoc(doc(db, "orders", req.body.orderId), {
      tokens: tokens
    }, { merge: true });


    if (!tokens.map(t => t.tx).includes(undefined)) {
      let admin = await getDoc(doc(db, "admins", order.shop));
      admin = admin.data();

      let TrackingInfo = tokens.map(t => {
        return {
          url: `${blockchainScans[t.blockchain]}${t.tx}`,
          number: t.tx
        };
      });

      await CreateFulfillment(admin, order.fulfillmentOrder_id, TrackingInfo);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(500).json({
      msg: 'error'
    });
  }
});


router.get('/setAccount', async function (req, res) {
  try {
    console.log(req.query.orderId);
    await setDoc(doc(db, "orders", req.query.orderId), {
      buyerWallet: req.query.buyerWallet
    }, { merge: true });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(200).json({
      msg: "done",
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
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
    // req.body.line_items.forEach(item => {
    //   if (item.vendor = "Turtle NFT") {
    //     NFTItems.push(item);
    //     isNFT = true;
    //   }
    // });
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

router.post('/sendOrderEmail', sendOrderEmail);

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

    if (order.shop == "desert-farms.myshopify.com") {
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