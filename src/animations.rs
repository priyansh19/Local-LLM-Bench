/// Animation utilities for CLI (oh-my-pi inspired patterns)
pub struct Spinner {
    frames: Vec<&'static str>,
    current_frame: usize,
}

impl Spinner {
    pub fn new() -> Self {
        Self {
            // Braille spinner frames (oh-my-pi pattern)
            frames: vec!["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
            current_frame: 0,
        }
    }

    pub fn next_frame(&mut self) -> &str {
        let frame = self.frames[self.current_frame];
        self.current_frame = (self.current_frame + 1) % self.frames.len();
        frame
    }

    pub fn current(&self) -> &str {
        self.frames[self.current_frame]
    }
}

/// ASCII art splash screen
pub struct SplashScreen;

impl SplashScreen {
    pub fn render() -> String {
        r#"
  ╭─────────────────────────────────╮
  │   Local LLM Bench v0.2.0        │
  │   Benchmark local LLM models    │
  ╰─────────────────────────────────╯
        "#
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spinner() {
        let mut spinner = Spinner::new();
        let frame1 = spinner.next_frame();
        let frame2 = spinner.next_frame();
        assert_ne!(frame1, frame2);
    }

    #[test]
    fn test_spinner_cycles() {
        let mut spinner = Spinner::new();
        let start = spinner.current();

        for _ in 0..10 {
            spinner.next_frame();
        }

        // Should cycle back to start after 10 frames
        assert_eq!(spinner.current(), start);
    }

    #[test]
    fn test_splash_screen() {
        let splash = SplashScreen::render();
        assert!(splash.contains("LLM Bench"));
    }
}
