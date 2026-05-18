# DataHub Demo Sample Documents

Sample source files for the FinTech Knowledge Base demo seed.
These represent the documents that would normally be uploaded via the DataHub API
and stored in MinIO, then processed by the data-worker pipeline.

## Files

| File | MinIO path (storage_path) | Document UUID |
|---|---|---|
| `aapl_q4_fy2024.txt` | `demo/financial-reports/aapl_q4_fy2024.txt` | `00000000-0000-0000-0021-000000000001` |
| `msft_q4_fy2024.txt` | `demo/financial-reports/msft_q4_fy2024.txt` | `00000000-0000-0000-0021-000000000002` |
| `nvda_q4_fy2025.txt` | `demo/financial-reports/nvda_q4_fy2025.txt` | `00000000-0000-0000-0021-000000000003` |
| `sp500_sector_analysis_2024.txt` | `demo/market-research/sp500_sector_analysis_2024.txt` | `00000000-0000-0000-0021-000000000004` |
| `portfolio_risk_framework.txt` | `demo/market-research/portfolio_risk_framework.txt` | `00000000-0000-0000-0021-000000000005` |

## Datasources

| Name | UUID |
|---|---|
| Financial Reports | `00000000-0000-0000-0020-000000000001` |
| Market Research | `00000000-0000-0000-0020-000000000002` |

## How the seed works

The SQL seed (`migrations/postgres/datahub/002_demo_fintech_knowledge.sql`) inserts:

1. **2 datasources** — Financial Reports and Market Research
2. **5 documents** — status `indexed` (already processed)
3. **5 ingestions** — status `completed`, strategy `recursive_split`, model `all-minilm-l6-v2`
4. **21 chunks** — real text extracted from these documents
5. **21 embeddings** — in `chunk_384dimension` (384-dim), using deterministic
   pseudo-random unit vectors (`_demo_rand_vec` helper function, seeded per chunk)

> **Note:** The demo embeddings are random unit vectors, not real `all-minilm-l6-v2`
> embeddings. Vector similarity search will return results but ranking will not reflect
> true semantic similarity. To get real embeddings, upload these files via the API and
> trigger a real ingestion with `all-minilm-l6-v2`.

## Uploading files to MinIO for a real ingestion

```bash
# Start MinIO (from project root)
docker compose up -d minio

# Upload files using mc (MinIO client)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc cp aapl_q4_fy2024.txt local/datahub/demo/financial-reports/
mc cp msft_q4_fy2024.txt local/datahub/demo/financial-reports/
mc cp nvda_q4_fy2025.txt local/datahub/demo/financial-reports/
mc cp sp500_sector_analysis_2024.txt local/datahub/demo/market-research/
mc cp portfolio_risk_framework.txt local/datahub/demo/market-research/
```
