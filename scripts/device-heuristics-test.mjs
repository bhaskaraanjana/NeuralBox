import { estimateVramMB, getDeviceTier, inferGpuClass } from '../src/lib/device.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(inferGpuClass('NVIDIA GeForce RTX 3070') === 'discrete', 'RTX GPU should be classified as discrete');
  assert(inferGpuClass('Intel(R) UHD Graphics 750') === 'integrated', 'Intel UHD should be classified as integrated');

  const lowAdapterDiscrete = estimateVramMB({
    adapterLimitMB: 2048,
    gpuName: 'NVIDIA GeForce RTX 3070',
    deviceMemGB: 32,
    gpuClass: 'discrete',
  });
  assert(lowAdapterDiscrete.vramMB >= 8192, 'Discrete name hint should lift underestimated adapter limits');

  const integratedEstimate = estimateVramMB({
    adapterLimitMB: 512,
    gpuName: 'Intel(R) UHD Graphics 750',
    deviceMemGB: 16,
    gpuClass: 'integrated',
  });
  assert(integratedEstimate.vramMB >= 2048, 'Integrated fallback should provide a practical floor');

  assert(getDeviceTier(7000) === 'premium', '7000MB should map to premium tier');
  assert(getDeviceTier(3500) === 'performance', '3500MB should map to performance tier');
  assert(getDeviceTier(1600) === 'standard', '1600MB should map to standard tier');
  assert(getDeviceTier(900) === 'lite', '900MB should map to lite tier');

  console.log('Device heuristics test passed.');
}

run();
