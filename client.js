const URL = 'http://13.200.84.116:80';
const io = require('socket.io-client');
const username = "ID001";
const ss = require('socket.io-stream');
let socket = io(URL);
var ssh2 = require("ssh2");
var fs = require('fs');
var path = require('path');
const connected_master_clients = new Map();
const handleUserInput = require('./lib/system');
const getSystemInfo = require('./lib/info');

// Ping-Pong Mechanism
let pingInterval;
let pongTimeout;

function startPingPong() {
    pingInterval = setInterval(() => {
        console.log('Sending ping to server');
        socket.emit('ping_custom', {
            id: username
        }); // Use a custom event for ping

        // Wait for pong within 5 seconds
        pongTimeout = setTimeout(() => {
            console.log('Pong not received, attempting to reconnect...');
            attemptReconnect();
        }, 5000); // Adjust the timeout as needed
    }, 5000); // Send ping every 5 seconds
}

function stopPingPong() {
    clearInterval(pingInterval);
    clearTimeout(pongTimeout);
}

function attemptReconnect() {
    stopPingPong(); // Stop the ping-pong process
    //   socket.disconnect(); // Disconnect the current connection
    //   socket.connect(); // Attempt to reconnect
    startPingPong();
}

// Function to get directory contents using ssh2
function getDirectoryContentsSsh2(connection, directory) {
    try {
        return new Promise((resolve, reject) => {
            connection.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                sftp.readdir(directory, (err, files) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const fileSystem = [];
                    files.forEach((file) => {
                        const name = file.filename;
                        const type = file.longname.startsWith('d') ? 'folder' : 'file';
                        fileSystem.push({ name, type });
                    });
                    resolve(fileSystem);
                });
            });
        });
    } catch (error) {
        console.log(error.message);
    }
};

socket.on('connect', () => {
    socket = io(URL);
    console.log('connected to server');
    // Connection handle
    socket.emit('minion', {
        id: username,
        key: "A123B"
    });

    startPingPong();
    // Handle pong response from the server
    socket.on('pong_custom', () => {
        console.log('Pong received from server');
        clearTimeout(pongTimeout); // Clear the pong timeout
    });

    socket.on('con-masterId', (data) => {
        connected_master_clients.set(data.masterId, { "winSts": false });
    });

    socket.on('dis-masterId', (data) => {
        connected_master_clients.delete(data.masterId);
    });

    socket.on('getInfo', (data) => {
        getSystemInfo().then((info) => {
            socket.emit('sysInfo', {
                masterId: data.masterId,
                info: info
            });
        }).catch(() => {
            console.log("error");
        })
    });

    // FTP handle
    ss(socket).on('file', (stream, data) => {
        try {
            // console.log(data.name);
            const filepath = data.name;
            stream.pipe(fs.createWriteStream(filepath));
            stream.on('end', () => console.log(`file saved to ${filepath}`));
        } catch (error) {
            console.log(error.message);
        }
    });

    socket.on("getMinionFile", (data) => {
        console.log(data);
        var stream = ss.createStream();
        var size = 0;

        try {
            var totalBytes = fs.statSync(data.path).size;
            var blobStream = fs.createReadStream(data.path);

            blobStream.on('data', function (chunk) {
                size += chunk.length;
                console.log(`Uploading ${Math.floor(size / totalBytes * 100)} %`);
            });

            blobStream.on('end', function () {
                console.log('Done send');
            });

            ss(socket).emit('getFile', stream, {
                masterId: data.masterId,
                name: path.basename(blobStream.path),
                size: totalBytes
            });

            blobStream.pipe(stream);
        } catch (error) {
            console.log(error.message);
        }

        socket.on("cansel-download", () => {
            console.log("stream destroy");
            stream.destroy();
            setTimeout(() => {
                stream = ss.createStream();
            }, 100);
        });
    });

    // SSH handle
    socket.on('openssh', (data) => {
        connected_master_clients.set(data.masterId, { "winSts": true });
        const sshConnection = new ssh2.Client();
        console.log(`connect ${data.termId}`);
        sshConnection.on('ready', function () {
            sshConnection.shell(function (err, stream) {
                if (err) throw err;
                socket.on(data.termId, function (input) {
                    stream.write(input.data);
                });
                // Send output from the SSH connection stream to the corresponding client socket
                stream.on('data', function (termdata) {
                    socket.emit('terminal-output', {
                        data: termdata.toString(),
                        termId: data.termId,
                        masterId: data.masterId
                    });
                });
            });
        });
        sshConnection.connect({
            host: "localhost",
            port: "22",
            username: data.username,
            password: data.password,
            // debug: console.log
        });
        sshConnection.on('error', (err) => {
            socket.emit('terminal-output', {
                data: err.toString(),
                termId: data.termId,
                masterId: data.masterId
            });
        });
        sshConnection.on("close", function () {
            console.log(`close ${data.termId}`);
            socket.emit('terminal-output', {
                data: "Close",
                termId: data.termId,
                masterId: data.masterId
            });
        });
    });

    // FTP handle
    socket.on('opensftp', (data) => {
        connected_master_clients.set(data.masterId, { "winSts": true });
        const sshConnection = new ssh2.Client();
        sshConnection.on('ready', function () {
            // Use getDirectoryContentsSsh2 function to get directory contents
            getDirectoryContentsSsh2(sshConnection, data.path)
                .then((fileSystem) => {
                    // console.log(fileSystem);
                    // // Send the file system array to the client socket
                    socket.emit('directory-contents', {
                        path: data.path,
                        fileSystem: fileSystem,
                        masterId: data.masterId,
                        sftpId: data.sftpId,
                    });
                })
                .finally(() => {
                    sshConnection.destroy();
                })
        });
        sshConnection.connect({
            host: "localhost",
            port: "22",
            username: data.username,
            password: data.password,
            // debug: console.log
        });
        sshConnection.on('error', (err) => {
            console.log(err.message);
        });
        sshConnection.on("close", function () {
            console.log(`close sftp`);
        });
    });

    socket.on('window-close', (data) => {
        connected_master_clients.set(data.masterId, { "winSts": false });
    });

    socket.on('reboot', (data) => {
        console.log(connected_master_clients);
        const isConnected = Array.from(connected_master_clients.values()).some((sts) => {
            return sts.winSts === true;
        });

        console.log(isConnected);
        if (isConnected == false) {
            handleUserInput('reboot');
        } else {
            socket.emit('errormsg', {
                masterId: data.masterId,
                ttl: "Reboot Error!",
                msg: "Another user is connected!",
            });
        }
    });

    socket.on('shoutdown', (data) => {
        const isConnected = Array.from(connected_master_clients.values()).some((sts) => {
            return sts.winSts === true;
        });

        console.log(isConnected);
        if (isConnected == false) {
            handleUserInput('shutdown');
        } else {
            socket.emit('errormsg', {
                masterId: data.masterId,
                ttl: "Shoutdown Error!",
                msg: "Another user is connected!",
            });
        }
    });
});

socket.on('disconnect', () => {
    console.log('disconnected from server');
    stopPingPong();
});