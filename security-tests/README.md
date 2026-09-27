# Security test harness

`exploits.sh` runs black-box attacks against the API Gateway and prints
`VULNERABLE` or `SAFE` for each of 19 checks (V1–V10 plus OA1/OA2 for the
Google OIDC surface), covering the distinct vulnerabilities documented in the
report. The same script is run against the original and the hardened code so
the results are directly comparable. OA1/OA2 have no equivalent on the
original code (the OIDC feature didn't exist yet), so they only run — and
should be SAFE — against the hardened code.

## Usage

```bash
# point at a running gateway; admin creds enable the event-seeding checks
ADMIN_BOOTSTRAP_EMAIL=admin@eventhub.local \
ADMIN_BOOTSTRAP_PASSWORD='<the bootstrap password>' \
GATEWAY=http://127.0.0.1:7000 \
bash security-tests/exploits.sh
```

Requires `curl`, `jq` and `node` (node is used only to forge a JWT with the old
default secret for the V2 check).

## Results

| Run | Outcome |
|-----|---------|
| Original code (`results/before-fixes.txt`) | 17 vulnerable / 0 safe |
| Hardened code (`results/after-fixes.txt`)  | 0 vulnerable / 17 safe |
