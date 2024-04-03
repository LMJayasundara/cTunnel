const { exec } = require('child_process');

function handleUserInput(input) {
  input = input.toLowerCase().trim();

  if (input === 'reboot') {
    rebootSystem();
  } else if (input === 'shutdown') {
    shutdownSystem();
  } else {
    console.log('Invalid input. Please enter "reboot" or "shutdown".');
  }
};

function rebootSystem() {
  console.log('Rebooting system...');
  exec(getRebootCommand(), (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
};

function shutdownSystem() {
  console.log('Shutting down system...');
  exec(getShutdownCommand(), (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
};

function getRebootCommand() {
  switch (process.platform) {
    case 'win32':
      return 'shutdown /r /t 0';
    case 'linux':
    case 'darwin':
      return 'reboot';
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
};

function getShutdownCommand() {
  switch (process.platform) {
    case 'win32':
      return 'shutdown /s /t 0';
    case 'linux':
    case 'darwin':
      return 'shutdown -h now';
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
};

module.exports = handleUserInput;