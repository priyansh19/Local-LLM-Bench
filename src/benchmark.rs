use anyhow::Result;
use std::time::Instant;
use tracing::info;

use crate::models::Model;
use crate::results::Results;

pub struct Benchmark {
    model: Model,
}

impl Benchmark {
    pub fn new(model: Model) -> Self {
        Self { model }
    }

    pub async fn run(&mut self, dataset: &str, iterations: usize) -> Result<Results> {
        info!("Running benchmark with {} iterations", iterations);

        let mut results = Results::new(
            self.model.name.clone(),
            dataset.to_string(),
            self.model.model_type.clone(),
        );

        for i in 0..iterations {
            let start = Instant::now();
            let _output = self.model.infer("Sample input text")?;
            let duration = start.elapsed();

            let latency_ms = duration.as_secs_f64() * 1000.0;
            results.add_latency(latency_ms);

            info!("Iteration {}/{} completed in {:.2}ms", i + 1, iterations, latency_ms);
        }

        Ok(results)
    }
}
