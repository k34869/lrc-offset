const fs = require('fs')

function error(msg, code) {
    console.error('\033[31merror\033[0m: ' + msg);
    if (code === undefined) eval(code);
    process.exit(1);
}

function delFile(path, reservePath) {
    if (fs.existsSync(path)) {
        if (fs.statSync(path).isDirectory()) {
            let files = fs.readdirSync(path);
            files.forEach((file) => {
                let currentPath = path + "/" + file;
                if (fs.statSync(currentPath).isDirectory()) 
                    delFile(currentPath, reservePath);
                else 
                    fs.unlinkSync(currentPath);
            });
            if (path != reservePath) 
                fs.rmdirSync(path);
        } else 
            fs.unlinkSync(path);
    }
}

module.exports = {
    error,
    delFile
}