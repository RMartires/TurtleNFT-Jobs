var express = require('express');
var router = express.Router();

const { ordersQueue } = require("../utill/ordersQueue");
const { contractQueue } = require('../utill/contractQueue');
const { transferQueue } = require('../utill/transferQueue');
/* GET home page. */
router.post('/processContract', async function (req, res) {
  try {
    contractQueue.add(req.body);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      msg: 'error'
    })
  }
});

router.post('/ordersCreate', async function (req, res) {
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
        name: req.shipping_address.name
      }
    }, { delay: 10000 });
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    msg: "done"
  });
});

router.post('/transfer', async function (req, res) {
  transferQueue.add({
    ...req.body
  });
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    msg: "done"
  });
});

module.exports = router;