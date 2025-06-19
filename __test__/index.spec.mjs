import test from 'ava'
import { solve } from '../index.js'
import fs from 'fs'

test('print initializer', async (t) => {
  const code = new RotatedSurfaceCode(5)
  try {
    console.time('myFunctionExecution');
    let result_str = await solve({
      initializer: code.initializer(),
      positions: code.visualize_positions(),
      solver_config: {
        "cluster_node_limit": 20,  // this default value is ok
      },
      syndrome_pattern: {
        defect_vertices: [7, 8, 13],
      },
      with_json: true,
      with_html: true,  // this is more expensive, only use for debugging
    })
    console.timeEnd('myFunctionExecution');
    let result = JSON.parse(result_str)
    const json = result.json  // contains the visualizer data
    const html = result.html  // can be saved to a file and opened in a browser
    // console.log(json.snapshots)  // this is the step-by-step decoding process
    if (html) {
      const filePath = 'index.spec.mjs.html';
      fs.writeFileSync(filePath, html)
      console.log(`HTML saved to ${filePath}`)
    }
    t.pass()
  } catch (e) {
    console.error("An error occurred:", e.message);
    t.fail()
  }
})


export class RotatedSurfaceCode {
  constructor(d, with_x_error = true, with_z_error = true, with_y_error = true) {
    this.d = d
    this.with_x_error = with_x_error
    this.with_z_error = with_z_error
    this.with_y_error = with_y_error
    // add vertices of the decoding graph
    this.positions = []
    this.position_to_vertex_idx = new Map()
    for (let i = -1; i <= 2 * this.d - 1; i++) {
      for (let j = -1; j <= 2 * this.d - 1; j++) {
        if (this.is_stabilizer(i, j)) {
          const position = { i, j }
          this.position_to_vertex_idx[`${i},${j}`] = this.positions.length
          this.positions.push(position)
        }
      }
    }
    this.data_qubit_positions = []
    this.position_to_data_qubit_idx = {}
    for (let i = 0; i < 2 * this.d - 1; i++) {
      for (let j = 0; j < 2 * this.d - 1; j++) {
        if (this.is_data_qubit(i, j)) {
          const position = { i, j }
          this.position_to_data_qubit_idx[position] = this.data_qubit_positions.length
          this.data_qubit_positions.push(position)
        }
      }
    }
    this.weighted_edges = []
    this.edge_error_info = []
    for (const data_qubit_position of this.data_qubit_positions) {
      const i = data_qubit_position.i
      const j = data_qubit_position.j
      const get_syndrome = (i, j, type) => {
        const syndrome = []
        for (const [di, dj] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
          if (this.is_x_stabilizer(i + di, j + dj) && type != 'X') {
            syndrome.push(this.position_to_vertex_idx[`${i + di},${j + dj}`])
          } else if (this.is_z_stabilizer(i + di, j + dj) && type != 'Z') {
            syndrome.push(this.position_to_vertex_idx[`${i + di},${j + dj}`])
          }
        }
        return syndrome
      }
      // Pauli X error
      for (const [enable, type] of [[this.with_x_error, 'X'], [this.with_z_error, 'Z'], [this.with_y_error, 'Y']]) {
        if (enable) {
          const syndrome = get_syndrome(i, j, type)
          this.edge_error_info.push({
            syndrome,
            error_type: type,
            data_qubit_position,
          })
          this.weighted_edges.push({ vertices: syndrome })
        }
      }
    }
  }

  is_qubit(x, y) {
    // the top-left data qubit is (0, 0), the top-right data qubit is (0, 2d-1)
    if (x < -1 || x > 2 * this.d - 1 || y < -1 || y > 2 * this.d - 1) {
      return false
    }
    if (x == -1 || x == 2 * this.d - 1) {
      if (y <= -1 || y >= 2 * this.d - 1) {
        return false
      }
      if (x == -1) {
        return y % 4 == 3
      } else {
        return y % 4 == 1
      }
    }
    if (y == -1) {
      return x % 4 == 1
    }
    if (y == 2 * this.d - 1) {
      return x % 4 == 3
    }
    return (x + y) % 2 == 0
  }

  is_data_qubit(x, y) {
    return this.is_qubit(x, y) && x % 2 == 0 && y % 2 == 0
  }

  is_stabilizer(x, y) {
    return this.is_qubit(x, y) && !this.is_data_qubit(x, y)
  }

  is_x_stabilizer(x, y) { // green
    return this.is_stabilizer(x, y) && (x + y) % 4 == 0
  }

  is_z_stabilizer(x, y) { // red
    return this.is_stabilizer(x, y) && (x + y) % 4 == 2
  }

  initializer() {
    return {
      vertex_num: this.positions.length,
      weighted_edges: this.weighted_edges,
    }
  }

  visualize_positions() {
    return this.positions.map(position => ({
      i: position.i / 1.5,
      j: position.j / 1.5,
    }))
  }
}

export function parse_rust_bigint(data) { // (data: any): bigint | number {
  if (typeof data === 'number' || typeof data === 'bigint') {
    return data
  } else if (typeof data === 'string') {
    return BigInt(data)
  } else if (typeof data === 'object') {
    assert(data.length === 2)
    const [sign, digits] = data
    assert(typeof sign === 'number')
    assert(sign == 1 || sign == -1 || sign == 0)
    assert(typeof digits === 'object')
    let value = 0n
    for (let i = digits.length - 1; i >= 0; i--) {
      value = (value << 32n) + BigInt(digits[i])
    }
    return BigInt(sign) * value
  } else {
    throw new Error(`invalid data type: ${typeof data}`)
  }
}
