const fs = require('fs')

function error(msg, code) {
    console.error('\033[31merror\033[0m: ' + msg);
    if (code === undefined) eval(code);
    process.exit(1);
}

module.exports = {
    error
}