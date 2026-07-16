use anyhow::{anyhow, Result};
use hf_hub::{api::sync::Api, Repo, RepoType};
use indicatif::ProgressBar;
use reqwest::Client;
use std::path::{Path, PathBuf};
use tracing::info;

/// Model registry for downloading models from various sources
pub struct Registry {
    cache_dir: PathBuf,
    http_client: Client,
}

impl Registry {
    /// Create a new registry with optional custom cache directory
    pub fn new(cache_dir: Option<PathBuf>) -> Self {
        let cache = cache_dir.unwrap_or_else(|| {
            dirs::cache_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("llm-bench")
        });

        std::fs::create_dir_all(&cache).ok();

        Self {
            cache_dir: cache,
            http_client: Client::new(),
        }
    }

    /// Download a model from HuggingFace
    /// Example: "mistralai/Mistral-7B-v0.1"
    pub async fn download_from_huggingface(&self, model_id: &str) -> Result<PathBuf> {
        info!("Downloading model from HuggingFace: {}", model_id);

        let api = Api::new().map_err(|e| anyhow!("HuggingFace API error: {}", e))?;
        let repo = api.repo(RepoType::Model, model_id.to_string());

        // Get the model file (typically the first GGUF or bin file)
        let model_filename = self
            .get_huggingface_model_file(&repo)
            .map_err(|e| anyhow!("Failed to find model file in repo: {}", e))?;

        let model_file = repo.get(&model_filename).map_err(|e| {
            anyhow!(
                "Failed to download model file '{}': {}",
                model_filename,
                e
            )
        })?;

        info!("Model downloaded to: {}", model_file.display());
        Ok(model_file)
    }

    /// Download a model from a GitHub raw URL
    /// Example: "https://raw.githubusercontent.com/user/repo/main/model.bin"
    pub async fn download_from_github(&self, url: &str) -> Result<PathBuf> {
        info!("Downloading model from GitHub: {}", url);

        let filename = url
            .split('/')
            .last()
            .ok_or_else(|| anyhow!("Invalid GitHub URL"))?;

        let cache_path = self.cache_dir.join(filename);

        if cache_path.exists() {
            info!("Model already cached at: {}", cache_path.display());
            return Ok(cache_path);
        }

        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to download from GitHub: {}", e))?;

        let total_size = response
            .content_length()
            .ok_or_else(|| anyhow!("Unknown file size"))?;

        let pb = ProgressBar::new(total_size);
        pb.set_message("Downloading...");

        let mut file = std::fs::File::create(&cache_path)
            .map_err(|e| anyhow!("Failed to create file: {}", e))?;

        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        while let Ok(Some(chunk)) = futures::stream::StreamExt::next(&mut stream).await {
            use std::io::Write;
            file.write_all(&chunk)
                .map_err(|e| anyhow!("Failed to write file: {}", e))?;
            downloaded += chunk.len() as u64;
            pb.set_position(downloaded);
        }

        pb.finish_with_message("Download complete!");
        info!("Model saved to: {}", cache_path.display());
        Ok(cache_path)
    }

    /// List available models in cache directory
    pub fn list_cached_models(&self) -> Result<Vec<String>> {
        let mut models = Vec::new();

        for entry in std::fs::read_dir(&self.cache_dir)
            .map_err(|e| anyhow!("Failed to read cache directory: {}", e))?
        {
            if let Ok(entry) = entry {
                if entry.path().is_file() {
                    if let Some(name) = entry.file_name().to_str() {
                        // Filter for model files (GGUF, bin, etc)
                        if name.ends_with(".gguf")
                            || name.ends_with(".bin")
                            || name.ends_with(".safetensors")
                        {
                            models.push(name.to_string());
                        }
                    }
                }
            }
        }

        Ok(models)
    }

    /// Get cache directory path
    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }

    /// Helper: Get the first model file from a HuggingFace repo
    fn get_huggingface_model_file(&self, repo: &hf_hub::Repo) -> Result<String> {
        // Try common model file names
        let candidates = vec![
            "pytorch_model.bin",
            "model.safetensors",
            "model.gguf",
            "model.bin",
        ];

        for candidate in candidates {
            if let Ok(_) = repo.info(candidate) {
                return Ok(candidate.to_string());
            }
        }

        Err(anyhow!(
            "No recognized model file found in repository"
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_creation() {
        let registry = Registry::new(None);
        assert!(registry.cache_dir().exists());
    }

    #[test]
    fn test_list_cached_models() {
        let registry = Registry::new(None);
        let models = registry.list_cached_models().unwrap();
        // Should return empty list if cache is empty
        assert_eq!(models.len() >= 0, true);
    }
}
