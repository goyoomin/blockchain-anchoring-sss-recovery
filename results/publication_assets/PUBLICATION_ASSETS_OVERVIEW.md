# Publication Assets Overview

## Recommended Main-Text Figures

1. Figure 1 log-scale gas plot — Results 4.2 (anchoring gas scalability). Use the linear version when absolute magnitude is the focus.
2. Figure 2 recovery-time plot — Results 4.3 (counterbalanced recovery performance).
3. Figure 3 transaction-count plot — Results 4.2 or 4.4 (structural scalability).
4. Figure 5 representative component plot — Results 4.3 and Discussion (recovery bottlenecks).
5. Figure 4 gas-reduction plot — Results 4.2, after the primary gas plot.

## Recommended Supplementary Figures

- Figure 5 full component plot for all n conditions.
- Figure A1 paired recovery delta and 95% CI.
- Figure 1 alternate linear/log rendering not selected for the main text.

## Recommended Tables

- Table 1 in Methods or Experimental Setup.
- Tables 2 and 3 in Results 4.2 and 4.3.
- Table 4 in Results 4.4 or the scalability subsection.
- Table 5 in Discussion or Results 4.3; use Table S1 as supplementary material.

All publication assets are derived only from validated files in `results/analysis/final_statistics/`. PNG files target 300 dpi, while SVG and PDF versions retain vector geometry.
<!-- PEDIN_EXTERNAL_BASELINE_OVERVIEW -->
## External Baseline Assets

- Figure 6 — Pedin paper-grid validation; recommended for **Results – External Baseline Validation**. It validates the paper-guided fixed-size setup-gas scalability pattern.
- Figure 7 — common-grid normalized scalability; recommended for **Results – Cross-Method Scalability Comparison**. It compares normalized scaling behavior without ranking different on-chain payloads.
- Table 6 — detailed Pedin paper-grid statistics; place in Results or Supplementary Materials depending on the page limit.
- Table 7 — same-n cross-method comparison; recommended for Results.
- Table S2 — methodological fidelity and controlled assumptions; recommended for Supplementary Materials.

The Pedin assets use the frozen paper-guided reimplementation of Pedin et al.'s Merkle-SHA256 setup. Figure 6 compares the original paper's reported qualitative trend with our paper-guided measurement; no Figure 9 coordinates were digitized or estimated. Figure 7 is restricted to setup/anchoring gas scaling and explicitly distinguishes recovery-address-plus-root setup, root-only anchoring, and n-share-hash anchoring.
