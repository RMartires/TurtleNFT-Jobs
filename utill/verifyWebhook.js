const crypto = require("crypto");

require('dotenv').config();

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

exports.verifyWebhook = async (req, res, buf, encoding) => {
    if (["/ordersCreate", "/uninstall"].includes(req.url)) {
        const hmac = req.get("X-Shopify-Hmac-Sha256");
        const hash = crypto
            .createHmac("sha256", SHOPIFY_API_SECRET)
            .update(buf.toString(encoding), "utf8", "hex")
            .digest("base64");
        if (hash === hmac) {
            req.auth = true;
        } else {
            req.auth = false;
        }
    }

};
