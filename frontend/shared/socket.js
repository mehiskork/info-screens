window.createSocket = function ({ role, accessKey } = {}) {
    const options = { autoConnect: true };

    if (role && accessKey) {
        options.auth = { role, accessKey };
    }

    return io(options);
};