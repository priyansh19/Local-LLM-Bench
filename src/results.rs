use chrono::Local;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::cli::{Result, AppError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Results {
    pub model_name: String,
    pub dataset: String,
    pub model_type: String,
    pub timestamp: String,
    pub latencies: Vec<f64>,
}

impl Results {
    pub fn new(model_name: String, dataset: String, model_type: String) -> Self {
        Self {
            model_name,
            dataset,
            model_type,
            timestamp: Local::now().to_rfc3339(),
            latencies: Vec::new(),
        }
    }

    pub fn add_latency(&mut self, latency_ms: f64) {
        self.latencies.push(latency_ms);
    }

    pub fn average_latency(&self) -> f64 {
        if self.latencies.is_empty() {
            0.0
        } else {
            self.latencies.iter().sum::<f64>() / self.latencies.len() as f64
        }
    }

    pub fn min_latency(&self) -> f64 {
        self.latencies
            .iter()
            .copied()
            .fold(f64::INFINITY, f64::min)
    }

    pub fn max_latency(&self) -> f64 {
        self.latencies
            .iter()
            .copied()
            .fold(f64::NEG_INFINITY, f64::max)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| AppError(format!("JSON serialization error: {}", e)))?;
        std::fs::write(path, json)
            .map_err(|e| AppError(format!("Failed to write file: {}", e)))?;
        Ok(())
    }

    pub fn load(path: &Path) -> Result<Self> {
        let json = std::fs::read_to_string(path)
            .map_err(|e| AppError(format!("Failed to read file: {}", e)))?;
        serde_json::from_str(&json)
            .map_err(|e| AppError(format!("Failed to parse results: {}", e)))
    }

    pub fn format(&self, format: &str) -> Result<String> {
        match format {
            "json" => serde_json::to_string_pretty(self)
                .map_err(|e| AppError(format!("JSON serialization error: {}", e))),
            "csv" => self.to_csv(),
            "html" => self.to_html(),
            _ => Err(AppError(format!("Unknown format: {}", format))),
        }
    }

    fn to_csv(&self) -> Result<String> {
        let mut csv = String::from("Model,Dataset,Type,Timestamp,Average(ms),Min(ms),Max(ms)\n");
        csv.push_str(&format!(
            "{},{},{},{},{:.2},{:.2},{:.2}\n",
            self.model_name,
            self.dataset,
            self.model_type,
            self.timestamp,
            self.average_latency(),
            self.min_latency(),
            self.max_latency()
        ));
        Ok(csv)
    }

    fn to_html(&self) -> Result<String> {
        let html = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <title>Benchmark Results - {}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .metric {{ margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }}
        .label {{ font-weight: bold; }}
    </style>
</head>
<body>
    <h1>Benchmark Results</h1>
    <div class="metric">
        <span class="label">Model:</span> {}
    </div>
    <div class="metric">
        <span class="label">Dataset:</span> {}
    </div>
    <div class="metric">
        <span class="label">Average Latency:</span> {:.2} ms
    </div>
    <div class="metric">
        <span class="label">Min Latency:</span> {:.2} ms
    </div>
    <div class="metric">
        <span class="label">Max Latency:</span> {:.2} ms
    </div>
    <div class="metric">
        <span class="label">Iterations:</span> {}
    </div>
</body>
</html>"#,
            self.model_name,
            self.model_name,
            self.dataset,
            self.average_latency(),
            self.min_latency(),
            self.max_latency(),
            self.latencies.len()
        );
        Ok(html)
    }
}
