#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use mwpf::mwpf_solver::{SolverSerialJointSingleHair, SolverTrait};
use mwpf::util::*;
use mwpf::visualize::*;
use napi::bindgen_prelude::*;
use napi::JsString;
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
pub struct SolverInput {
  initializer: SolverInitializer,
  syndrome_pattern: SyndromePattern,
  #[serde(default = "Default::default")]
  positions: Vec<VisualizePosition>,
  #[serde(default = "empty_config")]
  solver_config: serde_json::Value,
  #[serde(default = "Default::default")]
  with_json: bool,
  #[serde(default = "Default::default")]
  with_html: bool,
  #[serde(default = "empty_config")]
  html_override_config: serde_json::Value,
}

fn empty_config() -> serde_json::Value {
  json!({})
}

pub struct AsyncSolve {
  input: serde_json::Value,
}

impl Task for AsyncSolve {
  type Output = serde_json::Value;
  type JsValue = JsString; // we cannot use JsObject here because otherwise the bigint will be converted to something like {"$serde_json::private::Number": "1.0"}

  fn compute(&mut self) -> Result<Self::Output> {
    let result = std::panic::catch_unwind(|| -> serde_json::Value {
      let problem: SolverInput = serde_json::from_value(self.input.clone()).unwrap();
      let mut visualizer = None;
      if problem.with_json || problem.with_html {
        visualizer =
          Some(Visualizer::new(Some(String::new()), problem.positions.clone(), true).unwrap());
      }
      let mut solver = SolverSerialJointSingleHair::new(
        &Arc::new(problem.initializer.clone()),
        problem.solver_config.clone(),
      );
      solver.solve_visualizer(problem.syndrome_pattern.clone(), visualizer.as_mut());
      let (subgraph, weight_range) = solver.subgraph_range_visualizer(visualizer.as_mut());
      // construct result
      let mut result = serde_json::Map::new();
      if problem.with_json {
        result.insert(
          "json".to_string(),
          visualizer.as_mut().unwrap().get_visualizer_data(),
        );
      }
      if problem.with_html {
        result.insert(
          "html".to_string(),
          visualizer
            .as_mut()
            .unwrap()
            .generate_html(problem.html_override_config.clone())
            .into(),
        );
      }
      result.insert(
        "subgraph".to_string(),
        subgraph.iter().cloned().collect::<Vec<_>>().into(),
      );
      result.insert(
        "weight_range".to_string(),
        json!({
          "lower": weight_range.lower.to_f64(),
          "upper": weight_range.upper.to_f64(),
          "ln": numer_of(&weight_range.lower),
          "ld": denom_of(&weight_range.lower),
          "un": numer_of(&weight_range.upper),
          "ud": denom_of(&weight_range.upper),
        }),
      );
      result.into()
    });
    match result {
      Ok(result) => Ok(result),
      Err(_) => Err(Error::from_reason("panicked")),
    }
  }

  fn resolve(&mut self, env: Env, output: Self::Output) -> Result<Self::JsValue> {
    let result_str = serde_json::to_string(&output).unwrap();
    env
      .to_js_value(&result_str)
      .map(|v| JsString::try_from(v))?
  }

  fn reject(&mut self, _env: Env, err: Error) -> Result<Self::JsValue> {
    Err(err)
  }
}

#[napi]
pub fn solve(input: serde_json::Value, signal: Option<AbortSignal>) -> AsyncTask<AsyncSolve> {
  AsyncTask::with_optional_signal(AsyncSolve { input }, signal)
}
