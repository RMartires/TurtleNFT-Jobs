const fs = require('fs/promises');
const axios = require('axios');
const { Promise } = require('bluebird');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, getDownloadURL, listAll, uploadBytes } = require("firebase/storage");
const StreamZip = require('node-stream-zip');
let { db, connectDB } = require('./db');
const { startCreating } = require('../modules/genart/index');
const { download_image } = require('./downloadImage');
require('dotenv').config();

const { contractQueue } = require('../utill/contractQueue');

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

async function loadLayerFolder(shop, contract) {
    const storage = getStorage();
    let storageRef = ref(storage, `users/${shop}/${contract}/layers.zip`);
    // let inputFolder = [];
    // let res = await listAll(storageRef);
    // res = await Promise.map(res.prefixes, async (prefix) => {
    //     let data = { name: prefix.name };
    //     let images = await listAll(prefix);
    //     data.images = await Promise.map(images.items, async (item) => {
    //         let url = await getDownloadURL(item);
    //         return {
    //             filename: item.name,
    //             url: url
    //         }
    //     });
    //     inputFolder.push(data);
    // });
    let layers = [];

    let url = await getDownloadURL(storageRef);
    await fs.mkdir(`${__dirname}/../modules/genart/layers/${shop}`, { recursive: true });
    await download_image(url, `${__dirname}/../modules/genart/layers/${shop}/layers.zip`);
    const zip = new StreamZip.async({ file: `${__dirname}/../modules/genart/layers/${shop}/layers.zip` });
    zip.on('extract', (entry, file) => {
        layers.push(entry.name.split("/")[0]);
    });
    const count = await zip.extract(null, `${__dirname}/../modules/genart/layers/${shop}/layers`);
    await zip.close();

    return layers.filter(onlyUnique);


    // await Promise.map(inputFolder, async (folder) => {
    //     await fs.mkdir(`${__dirname}/../modules/genart/layers/${shop}/${folder.name}`, { recursive: true });
    //     await Promise.map(folder.images, async (image) => {
    //         await download_image(image.url, `${__dirname}/../modules/genart/layers/${shop}/${folder.name}/${image.filename}`);
    //     });
    // });
}


var JsonToArray = function (json) {
    var str = JSON.stringify(json, null, 0);
    var ret = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
        ret[i] = str.charCodeAt(i);
    }
    return ret
};


module.exports = async function (job, done) {
    console.log(job.data);
    try {
        db = await connectDB();
        let Contract = await getDoc(doc(db, "contracts", job.data.filename));
        if (!Contract.exists()) throw new Error(`Error: contract ${job.data.filename} does not exist`);
        Contract = Contract.data();


        const shop = job.data.user;
        const contract = Contract.contractName;

        let layers = await loadLayerFolder(shop, contract);
        let layerConfigurations = [
            {
                growEditionSizeTo: Contract.tokens[0].number,
                layersOrder: layers.map(x => ({ name: x })),
            },
        ];

        console.log(layerConfigurations[0].layersOrder);

        job.progress(1);
        let res = await startCreating(shop, layerConfigurations, job);

        job.progress(66);
        const storage = getStorage();
        await Promise.map(res.images, async (image) => {
            let storageRef = ref(storage, `users/${shop}/${contract}${image.fileName}`);
            return uploadBytes(storageRef, image.data);
        });
        await Promise.map(res.metadataFiles, async (metafiles) => {
            let storageRef = ref(storage, `users/${shop}/${contract}${metafiles.fileName}`);
            return uploadBytes(storageRef, JsonToArray(JSON.parse(metafiles.data)));
        });

        let storageRef = ref(storage, `users/${shop}/${contract}/gifFile.gif`);
        uploadBytes(storageRef, res.gifData.data);

        job.progress(90);
        await fs.rm(`${__dirname}/../modules/genart/layers/${shop}`, { recursive: true });


        job.progress(100);

        contractQueue.add(job.data, {
            attempts: 5,
        });
        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        console.log('hit1');
        console.log(err);
        done(new Error(err.message));
    }
}

