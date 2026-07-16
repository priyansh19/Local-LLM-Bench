use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::fmt;

use crate::benchmark::Benchmark;
use crate::models::Model;

#[derive(Debug)]
pub struct AppError(String);

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for AppError {}

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Parser)]
#[command(name = "llm-bench")]
#[command(about = "A comprehensive benchmarking framework for local LLM models", long_about = None)]
#[command(version)]
pub struct Args {
    #[command(subcommand)]
    pub command: Commands,

    /// Enable verbose logging
    #[arg(global = true, short, long)]
    pub verbose: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Run a benchmark on a local LLM model
    Run {
        /// Path to the model file or directory
        #[arg(value_name = "MODEL_PATH")]
        model_path: PathBuf,

        /// Benchmark dataset to use
        #[arg(short, long, default_value = "standard")]
        dataset: String,

        /// Number of iterations
        #[arg(short, long, default_value = "5")]
        iterations: usize,

        /// Output file for results
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// List available benchmark datasets
    ListDatasets,

    /// Show detailed information about a model
    Info {
        /// Path to the model file or directory
        #[arg(value_name = "MODEL_PATH")]
        model_path: PathBuf,
    },

    /// Generate a report from benchmark results
    Report {
        /// Path to results JSON file
        #[arg(value_name = "RESULTS_FILE")]
        results_file: PathBuf,

        /// Output format (json, csv, html)
        #[arg(short, long, default_value = "json")]
        format: String,
    },
}

pub fn run(args: Args) -> Result<()> {
    match args.command {
        Commands::Run {
            model_path,
            dataset,
            iterations,
            output,
        } => {
            println!("Starting benchmark run...");
            println!(
                "Model: {}, Dataset: {}, Iterations: {}",
                model_path.display(),
                dataset,
                iterations
            );

            let model = Model::load(&model_path)?;
            let mut benchmark = Benchmark::new(model);
            let results = benchmark.run(&dataset, iterations)?;

            if let Some(output_path) = output {
                results.save(&output_path)?;
                println!("Results saved to: {}", output_path.display());
            } else {
                println!("{}", serde_json::to_string_pretty(&results)
                    .map_err(|e| AppError(format!("JSON serialization error: {}", e)))?);
            }

            Ok(())
        }

        Commands::ListDatasets => {
            println!("Available benchmark datasets:");
            println!("  - standard: Standard benchmark suite");
            println!("  - llama-eval: Llama evaluation dataset");
            println!("  - custom: Custom dataset path");
            Ok(())
        }

        Commands::Info { model_path } => {
            println!("Loading model information...");
            let model = Model::load(&model_path)?;
            println!("{}", model.info()?);
            Ok(())
        }

        Commands::Report {
            results_file,
            format,
        } => {
            println!("Generating report from: {}", results_file.display());
            let results = crate::results::Results::load(&results_file)?;
            let report = results.format(&format)?;
            println!("{}", report);
            Ok(())
        }
    }
}
