const wait = ms => new Promise(r => setTimeout(r, ms));

const retryOperation = (operation, args, delay, retries) => new Promise((resolve, reject) => {
    return operation(...args)
        .then(resolve)
        .catch((reason) => {
            if (retries > 0) {
                return wait(delay)
                    .then(retryOperation.bind(null, operation, args, delay, retries - 1))
                    .then(resolve)
                    .catch(reject);
            }
            return reject(reason);
        });
});

exports.retryOperation = retryOperation;