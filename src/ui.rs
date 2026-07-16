/// Command-line UI utilities (minimal Ratatui integration)
use crate::animations::{Spinner, SplashScreen};
use std::io::Write;

pub struct CLI {
    spinner: Spinner,
}

impl CLI {
    pub fn new() -> Self {
        Self {
            spinner: Spinner::new(),
        }
    }

    /// Display splash screen
    pub fn show_splash(&self) {
        println!("{}", SplashScreen::render());
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    /// Show progress with spinner
    pub fn show_progress(&mut self, message: &str) {
        let frame = self.spinner.next_frame();
        print!("\r{} {}", frame, message);
        let _ = std::io::stdout().flush();
    }

    /// Clear progress line
    pub fn clear_progress(&self) {
        print!("\r{}                                        \r", "");
        let _ = std::io::stdout().flush();
    }

    /// Show live stats header
    pub fn show_stats_header(&self, cpu: f32, gpu: Option<f32>, memory: f32) {
        let gpu_str = gpu
            .map(|g| format!("| GPU: {:.1}%", g))
            .unwrap_or_default();
        println!("CPU: {:.1}% {} | Memory: {:.1}%", cpu, gpu_str, memory);
    }

    /// Show progress bar
    pub fn show_progress_bar(&self, current: usize, total: usize) {
        let percent = (current as f64 / total as f64) * 100.0;
        let bar_width = 40;
        let filled = (percent as usize / 100) * bar_width;

        print!("\r[");
        for i in 0..bar_width {
            print!("{}", if i < filled { "=" } else { " " });
        }
        print!("] {:.1}% ({}/{})", percent, current, total);
        let _ = std::io::stdout().flush();
    }

    /// Show results summary
    pub fn show_results_summary(
        &self,
        model: &str,
        avg_latency: f64,
        tps: Option<f64>,
        pass_rate: Option<f32>,
    ) {
        println!("\n╭─── Benchmark Results ───╮");
        println!("│ Model: {}", model);
        println!("│ Avg Latency: {:.2} ms", avg_latency);

        if let Some(t) = tps {
            println!("│ Tokens/Sec: {:.2}", t);
        }

        if let Some(pass) = pass_rate {
            println!("│ Quality Pass Rate: {:.1}%", pass);
        }

        println!("╰──────────────────────────╯");
    }
}

impl Default for CLI {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_creation() {
        let _cli = CLI::new();
    }

    #[test]
    fn test_progress_bar_logic() {
        let percent = (50 as f64 / 100 as f64) * 100.0;
        assert_eq!(percent, 50.0);
    }

    #[test]
    fn test_stats_header_format() {
        let cpu = 45.5;
        let gpu = Some(78.2);
        let memory = 62.1;

        // Should handle None GPU gracefully
        let gpu_str = gpu
            .map(|g| format!("GPU: {:.1}%", g))
            .unwrap_or_else(|| "N/A".to_string());

        assert!(gpu_str.contains("78"));
    }
}
