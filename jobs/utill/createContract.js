const fs = require('fs/promises');
const { contractTemplate } = require('./contractTemplate');

exports.createContract = async (filename, contractName, contractSymbol, totalSupply) => {
    await fs.writeFile(`${__dirname}/../../contracts/${filename}.sol`, contractTemplate(contractName, contractSymbol, { totalSupply: totalSupply }));
}