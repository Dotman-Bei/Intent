"""Pin the test environment before anything imports app.config.

`load_dotenv()` never overrides variables that are already set, so setting them here keeps the
suite hermetic: no RPC, no contracts, no API key, regardless of what a developer has in .env.
"""

import os

os.environ.setdefault("_INTENTFLOW_TEST", "1")

for key, value in {
    "ANTHROPIC_API_KEY": "",
    "BOT_RPC_URL": "http://127.0.0.1:1",  # nothing listens here — connection refused, instantly
    "STRATEGY_REGISTRY_ADDRESS": "",
    "INTENT_VAULT_ADDRESS": "",
    "APPROVAL_GATE_ADDRESS": "",
    "TEST_TOKEN_ADDRESS": "",
    "DEFAULT_APPROVAL_THRESHOLD": "100",
}.items():
    os.environ[key] = value
