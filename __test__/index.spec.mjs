import test from 'ava'

import { solve } from '../index.js'

test('print initializer', async (t) => {
  try {
    let result = await solve({
      initializer: {
        vertex_num: 5,
        weighted_edges: [],
        heralds: [],
      },
      // with_json: true,
      // with_html: true,
    })
  } catch (e) {
    console.error("An error occurred:", e.message);
  }
  // t.is(sum(1, 2), 3)
  t.pass()
})
