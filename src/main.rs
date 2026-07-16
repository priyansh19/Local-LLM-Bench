mod cli;
mod benchmark;
mod models;
mod results;

use clap::Parser;
use cli::Args;

fn main() {
    let args = Args::parse();
    if let Err(e) = cli::run(args) {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
