mod cli;
mod benchmark;
mod models;
mod results;

use anyhow::Result;
use clap::Parser;
use cli::Args;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("local_llm_bench=info".parse()?),
        )
        .init();

    let args = Args::parse();
    cli::run(args).await
}
