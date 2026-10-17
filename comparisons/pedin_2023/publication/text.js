const FIGURE_MARKER = "<!-- PEDIN_EXTERNAL_BASELINE_FIGURE_CAPTIONS -->";
const TABLE_MARKER = "<!-- PEDIN_EXTERNAL_BASELINE_TABLE_CAPTIONS -->";
const OVERVIEW_MARKER = "<!-- PEDIN_EXTERNAL_BASELINE_OVERVIEW -->";

function appendOrReplace(existing, marker, section) {
  const index = existing.indexOf(marker);
  if (index >= 0) return existing.slice(0, index) + section;
  const separator = existing.endsWith("\n") ? "" : "\n";
  return existing + separator + section;
}

function figureCaptionSection() {
  return `${FIGURE_MARKER}\n## Pedin External Baseline\n\n` +
    `**Figure 6.** Setup gas of the paper-guided Pedin Merkle-SHA256 baseline across the guardian counts evaluated in the paper-grid experiment. Each point represents the mean of 30 frozen executions, and error bars indicate 95% confidence intervals. Mean setup gas remained between approximately 66,827 and 66,830.6 gas across n = 2–192, corresponding to a relative range of approximately 0.0054%. The measurement evaluates agreement with the fixed-size gas-scaling trend reported by Pedin et al.; it is not claimed as an exact reproduction of their undisclosed original implementation.\n\n` +
    `**Figure 7.** Normalized on-chain gas scaling on the common grid (n = 10, 20, 50, and 100). Each mechanism is normalized by its own mean gas value at n = 10 to isolate scaling behavior from differences in fixed contract overhead. The Pedin paper-guided setup stores a recovery address together with a Merkle root, whereas our Merkle-Root mechanism anchors only the root and the Per-Share mechanism submits one anchoring transaction per share. The figure therefore compares relative scaling patterns rather than absolute gas efficiency.\n`;
}

function tableCaptionSection() {
  return `${TABLE_MARKER}\n## Pedin External Baseline\n\n` +
    `**Table 6.** Setup-gas statistics for the paper-guided Pedin Merkle-SHA256 baseline over all 13 paper-grid guardian counts. Values summarize 30 frozen executions per condition; deployment gas is excluded.\n\n` +
    `**Table 7.** Same-n common-grid comparison of mean gas, method-specific normalized gas, transaction count, and on-chain scope. Each mechanism uses its own n = 10 mean as the normalization denominator; differing payload responsibilities preclude an absolute-efficiency ranking.\n\n` +
    `**Table S2.** Fidelity classification and controlled assumptions for the paper-guided Pedin baseline, derived from the frozen Source Audit, Assumption Register, and Method Fidelity documentation.\n`;
}

function overviewSection() {
  return `${OVERVIEW_MARKER}\n## External Baseline Assets\n\n` +
    `- Figure 6 — Pedin paper-grid validation; recommended for **Results – External Baseline Validation**. It validates the paper-guided fixed-size setup-gas scalability pattern.\n` +
    `- Figure 7 — common-grid normalized scalability; recommended for **Results – Cross-Method Scalability Comparison**. It compares normalized scaling behavior without ranking different on-chain payloads.\n` +
    `- Table 6 — detailed Pedin paper-grid statistics; place in Results or Supplementary Materials depending on the page limit.\n` +
    `- Table 7 — same-n cross-method comparison; recommended for Results.\n` +
    `- Table S2 — methodological fidelity and controlled assumptions; recommended for Supplementary Materials.\n\n` +
    `The Pedin assets use the frozen paper-guided reimplementation of Pedin et al.'s Merkle-SHA256 setup. Figure 6 compares the original paper's reported qualitative trend with our paper-guided measurement; no Figure 9 coordinates were digitized or estimated. Figure 7 is restricted to setup/anchoring gas scaling and explicitly distinguishes recovery-address-plus-root setup, root-only anchoring, and n-share-hash anchoring.\n`;
}

function interpretationDocument() {
  return `# Pedin Publication Interpretation Boundary\n\n` +
    `## Original Paper Reported Trend\n\nPedin et al. report a fixed-size Merkle-root setup-gas trend as guardian count increases. The original Figure 9 coordinates are not digitized, estimated, or used as publication data.\n\n` +
    `## Our Paper-Guided Measurement\n\nThe frozen paper-guided Merkle-SHA256 setup showed essentially constant setup gas over n = 2–192. This is agreement with a structural trend, not a claim that the unpublished original contract or its absolute gas values were reproduced.\n\n` +
    `## Common-Grid Interpretation\n\nBoth Merkle-based approaches showed near-constant normalized on-chain gas growth over n = 10, 20, 50, and 100, whereas cumulative Per-Share anchoring increased approximately in proportion to the number of shares. Within the evaluated setup/anchoring operation, storing a fixed-size Merkle root decoupled on-chain gas growth from the number of off-chain shares. This statement does not characterize the complexity of either complete recovery protocol.\n\n` +
    `## Scope Boundary\n\nThe paper-guided Pedin setup stores a recovery address plus a Merkle root in one transaction. Our Merkle-Root method anchors only a Merkle root in one transaction. Our Per-Share method anchors n individual share hashes in n transactions. Because these responsibilities differ, the publication assets do not assert absolute gas superiority, protocol equivalence, recovery-performance superiority, or security superiority.\n\n` +
    `The implementation follows the paper-disclosed Shamir/Merkle-SHA256 setup structure, ordered parent hashing, last-leaf padding, proof construction, and PBK-plus-root setup transition, while undisclosed software and execution details remain controlled assumptions.\n`;
}

module.exports = {
  FIGURE_MARKER, TABLE_MARKER, OVERVIEW_MARKER, appendOrReplace,
  figureCaptionSection, tableCaptionSection, overviewSection, interpretationDocument,
};
