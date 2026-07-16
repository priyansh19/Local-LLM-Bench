mod cli;
mod benchmark;
mod models;
mod results;
mod registry;
mod inference;

use clap::Parser;
use cli::Args;

#[tokio::main]
async fn main() {
    let args = Args::parse();
    if let Err(e) = cli::run(args).await {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
