mod cli;
mod client;
mod commands;
mod lockfile;
mod output;
mod utils;

use anyhow::{Result, bail};
use clap::Parser;
use client::ApiClient;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = cli::Cli::parse();

    let lockfile = lockfile::read_lockfile()?;
    if !is_pid_running(lockfile.pid) {
        bail!(
            "Daemon process (PID {}) is no longer running. Start the daemon first.",
            lockfile.pid
        );
    }

    let api = ApiClient::new(&cli.daemon_url, &lockfile.token)?;

    if !api.health_check().await {
        eprintln!("⚠️  Could not reach daemon at {}", cli.daemon_url);
    }

    commands::run(&api, cli.command).await
}

fn is_pid_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{CloseHandle, STILL_ACTIVE};
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
        };

        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle == 0 {
                return false;
            }
            let mut exit_code: u32 = 0;
            let alive =
                windows_sys::Win32::System::Threading::GetExitCodeProcess(handle, &mut exit_code)
                    != 0
                    && exit_code == STILL_ACTIVE;
            CloseHandle(handle);
            alive
        }
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = pid;
        true
    }
}
