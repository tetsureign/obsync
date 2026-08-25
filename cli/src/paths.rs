use std::path::PathBuf;

use anyhow::{bail, Result};

const APP_NAME: &str = "obsync";

/// Resolves obsync's on-disk data directory.
///
/// This is obsync's single source of truth for filesystem locations and must
/// stay mirrored by daemon/src/common/utils/app-paths.ts — golden-value tests
/// on both sides pin the same literals.
fn resolve_data_dir(
    platform: &str,
    home: &str,
    xdg_data_home: Option<&str>,
    localappdata: Option<&str>,
) -> PathBuf {
    match platform {
        "macos" => PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join(APP_NAME),
        "windows" => {
            let base = match localappdata {
                Some(dir) if !dir.is_empty() => PathBuf::from(dir),
                _ => PathBuf::from(home).join("AppData").join("Local"),
            };
            base.join(APP_NAME)
        }
        // XDG Base Directory spec (Linux, BSDs); non-absolute overrides ignored
        _ => {
            let base = match xdg_data_home {
                Some(dir) if !dir.is_empty() && PathBuf::from(dir).is_absolute() => {
                    PathBuf::from(dir)
                }
                _ => PathBuf::from(home).join(".local").join("share"),
            };
            base.join(APP_NAME)
        }
    }
}

pub(crate) fn data_dir() -> Result<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    if home.is_empty() {
        bail!("Could not determine home directory");
    }

    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };

    Ok(resolve_data_dir(
        platform,
        &home,
        std::env::var("XDG_DATA_HOME").ok().as_deref(),
        std::env::var("LOCALAPPDATA").ok().as_deref(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linux_defaults_to_xdg_data_home() {
        assert_eq!(
            resolve_data_dir("linux", "/home/testuser", None, None),
            PathBuf::from("/home/testuser/.local/share/obsync")
        );
    }

    #[test]
    fn linux_honors_absolute_xdg_override() {
        assert_eq!(
            resolve_data_dir("linux", "/home/testuser", Some("/mnt/data"), None),
            PathBuf::from("/mnt/data/obsync")
        );
    }

    #[test]
    fn linux_ignores_relative_xdg_override() {
        assert_eq!(
            resolve_data_dir("linux", "/home/testuser", Some("relative/path"), None),
            PathBuf::from("/home/testuser/.local/share/obsync")
        );
    }

    #[test]
    fn macos_uses_application_support() {
        assert_eq!(
            resolve_data_dir("macos", "/Users/testuser", None, None),
            PathBuf::from("/Users/testuser/Library/Application Support/obsync")
        );
    }

    #[test]
    fn windows_prefers_localappdata() {
        // Separator handling is delegated to PathBuf on the target OS
        let dir = resolve_data_dir(
            "windows",
            "C:\\Users\\testuser",
            None,
            Some("C:\\AppData\\Local"),
        );
        assert!(dir.starts_with("C:\\AppData\\Local"));
        assert!(dir.ends_with("obsync"));
    }

    #[test]
    fn windows_falls_back_to_home() {
        let dir = resolve_data_dir("windows", "C:\\Users\\testuser", None, None);
        assert!(dir.starts_with("C:\\Users\\testuser"));
        assert!(dir.ends_with("obsync"));
    }
}
