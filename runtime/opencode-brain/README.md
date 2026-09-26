# OpenCode brain workspace (runtime)

This directory is the confined working directory (`cwd`) for `opencode run`
invocations made by the ECHO cognition engine. It intentionally contains no
game data, no secrets, and no repository access — agents receive all context
via the prompt and run with tools denied (see `.opencode/agents/echo-*.md`).
