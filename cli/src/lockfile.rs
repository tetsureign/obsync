use anyhow::{Context, Result};
use directories::ProjectDirs;
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
pub(crate) struct Lockfile {
    pub token: String,
    pub pid: u32,
}

pub(crate) fn read_lockfile() -> Result<Lockfile> {
    let dirs =
        ProjectDirs::from("", "", "obsync").context("Could not determine data directory")?;

    let path = dirs.data_dir().join("daemon.json");

    let content = fs::read_to_string(&path).with_context(|| {
        format!(
            "Daemon lockfile not found at {}. Is the daemon running?",
            path.display()
        )
    })?;

    serde_json::from_str(&content).context("Failed to parse daemon lockfile")
}
