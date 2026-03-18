window.createSocket = function () {
    return io({ autoConnect: true });
};