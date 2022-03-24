var express = require('express');
var router = express.Router();

const { MWCustomerData, MWCustomerErasure, MWShopErasure } = require("../controllers/mondatory");
const { uninstall } = require("../controllers/uninstall");
const { CreateProduct } = require("../controllers/products");
const { ChangePlan } = require("../controllers/plans");
const { ordersQueue } = require("../utill/ordersQueue");
const { contractQueue } = require('../utill/contractQueue');
const { transferQueue } = require('../utill/transferQueue');

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
          name: req.body.shipping_address.name
        }
      }, { delay: 10000 });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
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
  transferQueue.add({
    ...req.query
  }, {
    attempts: 1,
  });
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    msg: "done"
  });
});

module.exports = router;