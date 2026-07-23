# Contributing

Thanks for your interest in improving gatekeeper-suite.

## Ground rules

- **Never commit secrets.** No API keys, tokens, chat IDs, or real `settings.json`.
  The code reads everything from environment variables — keep it that way.
- A pre-commit `gitleaks` hook and a CI secret scan are provided; install and run them.
- Keep changes small and focused. Match the existing style.

## Development

```bash
# Run the governor test suite (offline, no network, no dependencies)
cd governor/..            # repo root
python -m unittest discover -t . -s governor/tests -p "test_*.py"

# Run the gatekeeper test suite
python gatekeeper/test_gatekeeper.py     # or: pytest -s gatekeeper/test_gatekeeper.py
```

- Governor uses only the Python standard library — do not add runtime dependencies
  to it. Gatekeeper dependencies live in `requirements.txt`.
- **Fail-open is a golden rule** for the governor: any error in the guard must
  release the tool, never trap the session.

## Pull requests

1. Add/adjust tests for your change.
2. Ensure both test suites pass and the secret scan is clean.
3. Describe the motivation and the user-visible effect.
