use std::time::Instant;
use std::collections::HashMap;
use futures::future::join_all;
use crate::cli::Result;
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
        println!("Running benchmark with {} iterations", iterations);

        let mut results = Results::new(
            self.model.name.clone(),
            dataset.to_string(),
            self.model.model_type.clone(),
        );

        for i in 0..iterations {
            let start = Instant::now();
            let _output = self.model.infer("Sample input text").await?;
            let duration = start.elapsed();

            let latency_ms = duration.as_secs_f64() * 1000.0;
            results.add_latency(latency_ms);

            println!("Iteration {}/{} completed in {:.2}ms", i + 1, iterations, latency_ms);
        }

        Ok(results)
    }

    /// Run concurrency sweep: test with 1, 2, 4, 8, 16... concurrent requests
    /// Returns throughput at each concurrency level
    pub async fn run_concurrency_sweep(&self, max_concurrency: usize) -> Result<HashMap<usize, f64>> {
        println!("Running concurrency sweep (binary search)...");

        let mut concurrency_results = HashMap::new();
        let mut concurrency = 1;
        let mut plateau_count = 0;
        let mut prev_throughput = 0.0;

        while concurrency <= max_concurrency && plateau_count < 2 {
            println!("Testing concurrency level: {}", concurrency);

            let start = Instant::now();
            let mut handles = vec![];

            for _ in 0..concurrency {
                let model = self.model.clone();
                let handle = tokio::spawn(async move {
                    model.infer("Sample input text").await
                });
                handles.push(handle);
            }

            // Wait for all concurrent requests to complete
            let results = join_all(handles).await;
            let duration = start.elapsed();

            // Count successful requests
            let successful = results.iter().filter(|r| r.is_ok() && r.as_ref().unwrap().is_ok()).count();
            let throughput = successful as f64 / duration.as_secs_f64();

            concurrency_results.insert(concurrency, throughput);
            println!("  Concurrency {}: {:.2} req/s", concurrency, throughput);

            // Check if throughput plateaued (< 5% improvement)
            let improvement = if prev_throughput > 0.0 {
                (throughput - prev_throughput) / prev_throughput * 100.0
            } else {
                100.0
            };

            if improvement < 5.0 && prev_throughput > 0.0 {
                plateau_count += 1;
            } else {
                plateau_count = 0;
            }

            prev_throughput = throughput;
            concurrency *= 2;
        }

        Ok(concurrency_results)
    }
}
