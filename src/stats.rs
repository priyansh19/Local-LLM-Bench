use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Statistical analysis of benchmark measurements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkStats {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub median: f64,
    pub std_dev: f64,
    pub p95: f64,
    pub p99: f64,
    pub count: usize,
}

impl BenchmarkStats {
    /// Calculate statistics from measurements
    pub fn calculate(measurements: &[f64]) -> Option<Self> {
        if measurements.is_empty() {
            return None;
        }

        let count = measurements.len();
        let min = *measurements.iter().min_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(&0.0);
        let max = *measurements.iter().max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(&0.0);

        let mean = measurements.iter().sum::<f64>() / count as f64;

        let variance = measurements
            .iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / count as f64;
        let std_dev = variance.sqrt();

        let median = Self::percentile(measurements, 50.0).unwrap_or(0.0);
        let p95 = Self::percentile(measurements, 95.0).unwrap_or(0.0);
        let p99 = Self::percentile(measurements, 99.0).unwrap_or(0.0);

        Some(Self {
            min,
            max,
            mean,
            median,
            std_dev,
            p95,
            p99,
            count,
        })
    }

    /// Calculate percentile
    fn percentile(data: &[f64], percentile: f64) -> Option<f64> {
        if data.is_empty() {
            return None;
        }

        let mut sorted = data.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let index = ((percentile / 100.0) * (sorted.len() - 1) as f64) as usize;
        sorted.get(index).copied()
    }

    /// Check if stats are valid
    pub fn is_valid(&self) -> bool {
        self.count > 0 && self.min >= 0.0 && self.max >= self.min
    }
}

/// Running statistics collector (streaming percentile calculation)
pub struct StreamingStats {
    measurements: VecDeque<f64>,
    window_size: usize,
}

impl StreamingStats {
    pub fn new(window_size: usize) -> Self {
        Self {
            measurements: VecDeque::with_capacity(window_size),
            window_size,
        }
    }

    /// Add a measurement
    pub fn add(&mut self, value: f64) {
        self.measurements.push_back(value);
        if self.measurements.len() > self.window_size {
            self.measurements.pop_front();
        }
    }

    /// Get current statistics
    pub fn get_stats(&self) -> Option<BenchmarkStats> {
        let data: Vec<f64> = self.measurements.iter().copied().collect();
        BenchmarkStats::calculate(&data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stats_calculation() {
        let measurements = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        let stats = BenchmarkStats::calculate(&measurements).unwrap();

        assert_eq!(stats.min, 10.0);
        assert_eq!(stats.max, 50.0);
        assert_eq!(stats.mean, 30.0);
        assert_eq!(stats.median, 30.0);
        assert_eq!(stats.count, 5);
    }

    #[test]
    fn test_streaming_stats() {
        let mut streaming = StreamingStats::new(3);
        streaming.add(10.0);
        streaming.add(20.0);
        streaming.add(30.0);

        let stats = streaming.get_stats().unwrap();
        assert_eq!(stats.count, 3);
        assert_eq!(stats.mean, 20.0);
    }

    #[test]
    fn test_streaming_stats_window() {
        let mut streaming = StreamingStats::new(2);
        streaming.add(10.0);
        streaming.add(20.0);
        streaming.add(30.0); // Should drop 10.0

        let stats = streaming.get_stats().unwrap();
        assert_eq!(stats.count, 2);
        assert_eq!(stats.min, 20.0);
        assert_eq!(stats.max, 30.0);
    }

    #[test]
    fn test_empty_measurements() {
        let measurements: Vec<f64> = vec![];
        let stats = BenchmarkStats::calculate(&measurements);
        assert!(stats.is_none());
    }
}
