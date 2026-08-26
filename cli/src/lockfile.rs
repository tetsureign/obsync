use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;

use crate::paths;

#[derive(Deserialize)]
pub(crate) struct Lockfile {
    pub token: String,
    pub pid: u32,
    #[serde(default)]
    pub port: u16,
}

pub(crate) fn read_lockfile() -> Result<Lockfile> {
    let path = paths::data_dir()?.join("daemon.json");

    let content = fs::read_to_string(&path).with_context(|| {
        format!(
            "Daemon lockfile not found at {}. Is the daemon running?",
            path.display()
        )
    })?;

    serde_json::from_str(&content).context("Failed to parse daemon lockfile")
}
