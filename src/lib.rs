#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use mwpf::util::*;
use serde::{Deserialize, Serialize};

#[napi]
pub fn sum(a: i32, b: i32) -> i32 {
  a + b
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Problem {
  initializer: SolverInitializer,
}

#[napi]
pub fn solve(problem: serde_json::Value) {
  println!("{:?}", problem);
}
