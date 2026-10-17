# Table P1 — Pedin Reimplementation Assumptions

| Item | Classification | Implementation |
| --- | --- | --- |
| Shamir threshold and k=n/2+1 | PAPER_EXPLICIT | secrets.js-grempe 2.0.0 |
| Merkle SHA256 | PAPER_EXPLICIT | SHA256 over UTF-8 encoded shares |
| SSS library and serialization | CONTROLLED_ASSUMPTION | Canonical library share string, UTF-8 |
| Compiler and optimizer | CONTROLLED_ASSUMPTION | solc 0.8.24, optimizer disabled |
| Deployment gas | CONTROLLED_ASSUMPTION | Recorded separately from setup receipt gas |
