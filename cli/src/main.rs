mod cli;
mod client;
mod commands;
mod output;

use anyhow::Result;
use clap::Parser;
use client::ApiClient;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = cli::Cli::parse();
    let api = ApiClient::new(&cli.daemon_url)?;

    if !api.health_check().await {
        eprintln!("⚠️  Could not reach daemon at {}", cli.daemon_url);
    }

    commands::run(&api, cli.command).await
}
