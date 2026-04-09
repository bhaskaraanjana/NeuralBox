import { analyzeRoutingTask, getModelTierRank, scoreModelForTask } from '../src/lib/routing.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const task = analyzeRoutingTask('Please debug this JavaScript exception and provide a root cause analysis.');
  assert(task.coding === true, 'Coding task should be detected');
  assert(task.reasoning === true, 'Reasoning task should be detected');
  assert(task.complex === true, 'Complex task should be detected');

  const tiny = { tier: 'lite', vramMB: 600, thinking: false, vision: false };
  const thinker = { tier: 'standard', vramMB: 1500, thinking: true, vision: false };
  const vision = { tier: 'vision', vramMB: 4000, thinking: false, vision: true };

  assert(getModelTierRank(tiny) < getModelTierRank(thinker), 'Tier rank should increase by model tier');
  assert(getModelTierRank(vision) >= getModelTierRank(thinker), 'Vision tier rank should be high');

  const speedTiny = scoreModelForTask(tiny, task, { profileMode: 'speed', deviceVramMB: 2048 });
  const speedThinker = scoreModelForTask(thinker, task, { profileMode: 'speed', deviceVramMB: 2048 });
  const qualityTiny = scoreModelForTask(tiny, task, { profileMode: 'quality', deviceVramMB: 2048 });
  const qualityThinker = scoreModelForTask(thinker, task, { profileMode: 'quality', deviceVramMB: 2048 });

  assert(speedThinker > speedTiny, 'Thinker model should score higher on complex coding task');
  assert(qualityThinker > qualityTiny, 'Quality profile should still prefer thinker for complex task');

  const imageTask = analyzeRoutingTask('what is in this image');
  const textScore = scoreModelForTask(thinker, imageTask, { hasImage: true, profileMode: 'balanced', deviceVramMB: 4096 });
  const visionScore = scoreModelForTask(vision, imageTask, { hasImage: true, profileMode: 'balanced', deviceVramMB: 4096 });
  assert(visionScore > textScore, 'Vision model should win when image input is present');

  console.log('Routing sanity test passed.');
}

run();
