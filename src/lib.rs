#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use mwpf::util::*;
use napi::bindgen_prelude::*;
use napi::JsUnknown;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize)]
pub struct SolverInput {
  initializer: SolverInitializer,
  #[serde(default = "Default::default")]
  with_json: bool,
  #[serde(default = "Default::default")]
  with_html: bool,
}

pub struct AsyncSolve {
  input: serde_json::Value,
}

impl Task for AsyncSolve {
  type Output = serde_json::Value;
  type JsValue = JsUnknown;

  fn compute(&mut self) -> Result<Self::Output> {
    let result = std::panic::catch_unwind(|| -> serde_json::Value {
      let problem: SolverInput = serde_json::from_value(self.input.clone()).unwrap();
      println!("problem: {:?}", problem);
      json!({})
    });
    match result {
      Ok(result) => Ok(result),
      Err(_) => Err(Error::from_reason("panicked")),
    }
  }

  fn resolve(&mut self, env: Env, output: Self::Output) -> Result<Self::JsValue> {
    env.to_js_value(&output)
  }

  fn reject(&mut self, _env: Env, err: Error) -> Result<Self::JsValue> {
    Err(err)
  }
}

#[napi]
pub fn solve(input: serde_json::Value, signal: Option<AbortSignal>) -> AsyncTask<AsyncSolve> {
  AsyncTask::with_optional_signal(AsyncSolve { input }, signal)
}
