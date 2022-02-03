const tempWebhook = async (req, res) => {
    try {
        if (!req.auth) throw new Error("Unauthorized");
        res.status(200).json({ msg: "done" })
    } catch (err) {
        res.status(401).json({ msg: "Unauthorized" })
    }
};

exports.MWCustomerData = tempWebhook;
exports.MWCustomerErasure = tempWebhook;
exports.MWShopErasure = tempWebhook;
