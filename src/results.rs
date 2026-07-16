use chrono::Local;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::collections::HashMap;

use crate::cli::{Result, AppError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub cpu_percent: f32,
    pub gpu_percent: Option<f32>,
    pub memory_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Results {
    pub model_name: String,
    pub dataset: String,
    pub model_type: String,
    pub timestamp: String,
    pub latencies: Vec<f64>,

    // Phase 2 metrics
    #[serde(default)]
    pub tokens_per_second: Option<f64>,
    #[serde(default)]
    pub throughput_curve: HashMap<usize, f64>,
    #[serde(default)]
    pub quality_pass_rate: Option<f32>,
    #[serde(default)]
    pub system_metrics: Option<SystemSnapshot>,
}

impl Results {
    pub fn new(model_name: String, dataset: String, model_type: String) -> Self {
        Self {
            model_name,
            dataset,
            model_type,
            timestamp: Local::now().to_rfc3339(),
            latencies: Vec::new(),
            tokens_per_second: None,
            throughput_curve: HashMap::new(),
            quality_pass_rate: None,
            system_metrics: None,
        }
    }

    pub fn set_tokens_per_second(&mut self, tps: f64) {
        self.tokens_per_second = Some(tps);
    }

    pub fn set_throughput_curve(&mut self, curve: HashMap<usize, f64>) {
        self.throughput_curve = curve;
    }

    pub fn set_quality_pass_rate(&mut self, rate: f32) {
        self.quality_pass_rate = Some(rate);
    }

    pub fn set_system_metrics(&mut self, snapshot: SystemSnapshot) {
        self.system_metrics = Some(snapshot);
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
        let mut csv = String::from("Model,Dataset,Type,Timestamp,Average(ms),Min(ms),Max(ms),Tokens/Sec,QualityPass%\n");
        let tps = self.tokens_per_second.map(|v| format!("{:.2}", v)).unwrap_or_else(|| "N/A".to_string());
        let pass = self.quality_pass_rate.map(|v| format!("{:.1}", v)).unwrap_or_else(|| "N/A".to_string());

        csv.push_str(&format!(
            "{},{},{},{},{:.2},{:.2},{:.2},{},{}\n",
            self.model_name,
            self.dataset,
            self.model_type,
            self.timestamp,
            self.average_latency(),
            self.min_latency(),
            self.max_latency(),
            tps,
            pass
        ));
        Ok(csv)
    }

    fn to_html(&self) -> Result<String> {
        let tps_html = self
            .tokens_per_second
            .map(|v| format!("<div class=\"metric\"><span class=\"label\">Tokens/Sec:</span> {:.2}</div>", v))
            .unwrap_or_default();

        let quality_html = self
            .quality_pass_rate
            .map(|v| format!("<div class=\"metric\"><span class=\"label\">Quality Pass Rate:</span> {:.1}%</div>", v))
            .unwrap_or_default();

        let system_html = self
            .system_metrics
            .as_ref()
            .map(|s| {
                format!(
                    "<div class=\"metric\"><span class=\"label\">System:</span> CPU {:.1}%, GPU {:?}%, Memory {:.1}%</div>",
                    s.cpu_percent,
                    s.gpu_percent.map(|g| format!("{:.1}", g)).unwrap_or_else(|| "N/A".to_string()),
                    s.memory_percent
                )
            })
            .unwrap_or_default();

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
    {}
    {}
    {}
</body>
</html>"#,
            self.model_name,
            self.model_name,
            self.dataset,
            self.average_latency(),
            self.min_latency(),
            self.max_latency(),
            self.latencies.len(),
            tps_html,
            quality_html,
            system_html
        );
        Ok(html)
    }
}
