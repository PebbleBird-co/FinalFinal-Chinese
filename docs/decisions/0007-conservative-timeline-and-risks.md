# 0007: Keep timeline events and risks conservative

- Status: Accepted
- Date: 2026-08-03

## Context

Filesystem timestamps can be changed by copying, restoring, archiving, or synchronizing files. A single
snapshot also cannot distinguish every creation from every modification with certainty.

## Decision

- Daily activity contains dates with observed metadata activity. It does not synthesize years of empty days
  between isolated timestamps.
- `createdFileCount` is populated only when a reliable creation timestamp is present on the same day as the
  observed modification. Modified-file activity remains the primary series.
- Project start uses the earliest ten percent of non-temporary activity after excluding a lone timestamp more
  than ninety days before the rest of the project.
- Small activity samples use the top-fifteen-percent rule; larger samples use mean plus 1.5 standard
  deviations.
- A branch event requires two high-confidence successors within seventy-two hours and evidence that both
  successors continue independently.
- A direction-shift event requires at least three independent directory, family, activity, or naming-theme
  signals and confidence of at least 0.60.
- Old-branch revival requires a gap of at least fourteen days plus competing activity from another family.
- Final-version bursts require at least three final or submitted markers inside forty-eight hours.
- Every event and every risk stores confidence, evidence, related files, and related families. Risk output is
  a review prompt and never triggers file modification.
- Apache ECharts is imported by module so the renderer includes only the chart types and components used by
  the timeline.

This phase does not rank an official version, accept user corrections, or persist analysis data.
