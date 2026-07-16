use anyhow::Result;
use sysinfo::{System, SystemExt, ProcessExt};
use std::process::Command;

/// System metrics snapshot
#[derive(Debug, Clone)]
pub struct SystemMetrics {
    pub cpu_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub gpu_percent: Option<f32>,
    pub gpu_memory_used_mb: Option<u64>,
    pub gpu_memory_total_mb: Option<u64>,
}

impl SystemMetrics {
    /// Get memory percentage
    pub fn memory_percent(&self) -> f32 {
        if self.memory_total_mb > 0 {
            (self.memory_used_mb as f32 / self.memory_total_mb as f32) * 100.0
        } else {
            0.0
        }
    }

    /// Get GPU memory percentage
    pub fn gpu_memory_percent(&self) -> Option<f32> {
        match (self.gpu_memory_used_mb, self.gpu_memory_total_mb) {
            (Some(used), Some(total)) if total > 0 => {
                Some((used as f32 / total as f32) * 100.0)
            }
            _ => None,
        }
    }
}

/// System metrics collector
pub struct MetricsCollector {
    system: System,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
        }
    }

    /// Collect current system metrics
    pub fn collect(&mut self) -> Result<SystemMetrics> {
        self.system.refresh_all();

        let cpu_percent = self.system.global_cpu_info().cpu_usage();
        let memory_used_mb = self.system.used_memory() / 1024;
        let memory_total_mb = self.system.total_memory() / 1024;

        let (gpu_percent, gpu_used, gpu_total) = self.collect_gpu_metrics().unwrap_or_default();

        Ok(SystemMetrics {
            cpu_percent,
            memory_used_mb,
            memory_total_mb,
            gpu_percent,
            gpu_memory_used_mb: gpu_used,
            gpu_memory_total_mb: gpu_total,
        })
    }

    /// Try to collect NVIDIA GPU metrics via nvidia-smi
    fn collect_gpu_metrics(&self) -> Result<(Option<f32>, Option<u64>, Option<u64>)> {
        let output = Command::new("nvidia-smi")
            .args(&[
                "--query-gpu=utilization.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits",
            ])
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = stdout.lines().next() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 3 {
                        let gpu_percent = parts[0].parse::<f32>().ok();
                        let gpu_used = parts[1].parse::<u64>().ok();
                        let gpu_total = parts[2].parse::<u64>().ok();
                        return Ok((gpu_percent, gpu_used, gpu_total));
                    }
                }
                Ok((None, None, None))
            }
            Err(_) => Ok((None, None, None)), // nvidia-smi not available
        }
    }
}

/// Aggregated metrics over multiple measurements
#[derive(Debug, Clone)]
pub struct MetricsAggregate {
    pub cpu_avg: f32,
    pub cpu_peak: f32,
    pub memory_avg_mb: u64,
    pub memory_peak_mb: u64,
    pub gpu_avg: Option<f32>,
    pub gpu_peak: Option<f32>,
}

impl MetricsAggregate {
    /// Create aggregate from list of metrics
    pub fn from_metrics(metrics: &[SystemMetrics]) -> Self {
        if metrics.is_empty() {
            return Self {
                cpu_avg: 0.0,
                cpu_peak: 0.0,
                memory_avg_mb: 0,
                memory_peak_mb: 0,
                gpu_avg: None,
                gpu_peak: None,
            };
        }

        let cpu_avg = metrics.iter().map(|m| m.cpu_percent).sum::<f32>() / metrics.len() as f32;
        let cpu_peak = metrics.iter().map(|m| m.cpu_percent).fold(f32::NEG_INFINITY, f32::max);

        let memory_avg_mb = metrics.iter().map(|m| m.memory_used_mb).sum::<u64>() / metrics.len() as u64;
        let memory_peak_mb = metrics.iter().map(|m| m.memory_used_mb).max().unwrap_or(0);

        let gpu_values: Vec<f32> = metrics.iter().filter_map(|m| m.gpu_percent).collect();
        let gpu_avg = if !gpu_values.is_empty() {
            Some(gpu_values.iter().sum::<f32>() / gpu_values.len() as f32)
        } else {
            None
        };

        let gpu_peak = gpu_values.iter().fold(None, |max, &val| {
            Some(max.map_or(val, |m: f32| m.max(val)))
        });

        Self {
            cpu_avg,
            cpu_peak,
            memory_avg_mb,
            memory_peak_mb,
            gpu_avg,
            gpu_peak,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_collector_creation() {
        let _collector = MetricsCollector::new();
    }

    #[test]
    fn test_system_metrics_memory_percent() {
        let metrics = SystemMetrics {
            cpu_percent: 50.0,
            memory_used_mb: 4096,
            memory_total_mb: 16384,
            gpu_percent: None,
            gpu_memory_used_mb: None,
            gpu_memory_total_mb: None,
        };
        let percent = metrics.memory_percent();
        assert!(percent > 24.0 && percent < 26.0); // Should be ~25%
    }

    #[test]
    fn test_metrics_aggregate() {
        let metrics = vec![
            SystemMetrics {
                cpu_percent: 20.0,
                memory_used_mb: 2048,
                memory_total_mb: 16384,
                gpu_percent: None,
                gpu_memory_used_mb: None,
                gpu_memory_total_mb: None,
            },
            SystemMetrics {
                cpu_percent: 40.0,
                memory_used_mb: 4096,
                memory_total_mb: 16384,
                gpu_percent: None,
                gpu_memory_used_mb: None,
                gpu_memory_total_mb: None,
            },
        ];

        let agg = MetricsAggregate::from_metrics(&metrics);
        assert_eq!(agg.cpu_avg, 30.0);
        assert_eq!(agg.cpu_peak, 40.0);
        assert_eq!(agg.memory_peak_mb, 4096);
    }
}
