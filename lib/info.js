const si = require('systeminformation');
var osu = require('node-os-utils');
var cpu = osu.cpu;

async function getSystemInfo() {
  const [osInfo, cpuInfo, memInfo, cpuTemp, diskUsage] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.mem(),
    si.cpuTemperature(),
    si.fsSize(),
  ]);

  const diskUsagePercent = parseFloat(((diskUsage[0].used / diskUsage[0].size) * 100)).toFixed(2);
  const cpuPercentage = await cpu.usage();

  return {
    os: `${osInfo.distro} ${osInfo.release}`,
    cpu: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
    cpuUsage: `${parseFloat(cpuPercentage).toFixed(2)}%`,
    cpuTemperature: `${parseFloat(cpuTemp.main).toFixed(2)}°C`,
    memoryUsage: `${parseFloat(((memInfo.used / memInfo.total) * 100)).toFixed(2)}%`,
    diskUsage: `${diskUsagePercent}%`,
  };
}

module.exports = getSystemInfo;