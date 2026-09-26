import { createWorld } from './packages/simulation-core/dist/world.js';
const w = createWorld(1337, 'Echo City', 40);
for (const id of ['c_003','c_014','c_023','c_010','c_035','c_008','c_019']) {
  const c = w.citizens[id];
  console.log(id, c.firstName, c.lastName, c.sex, c.age);
}
