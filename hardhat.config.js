require("@nomiclabs/hardhat-waffle");
require('dotenv').config();
const PRIVATE_KEY = process.env.PRIVATE_KEY;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "matic",
  networks: {
    hardhat: {
    },
    matic: {
      // url: "https://polygon-rpc.com",
      url: "https://rpc-mumbai.matic.today",
      // url: 'https://matic-mumbai.chainstacklabs.com',
      accounts: [PRIVATE_KEY],
      gasPrice: 8000000000,
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
};
