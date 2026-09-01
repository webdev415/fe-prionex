# Epic 5 Context: PRE-PROD Release Candidate Environment

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A release engineer can deploy a named image tag to a dedicated PRE-PROD stand that is backed by its own network and its own Kong gateway, validate the candidate there, and have that validation recorded in the container registry as the authoritative release history. It matters because without backend isolation the PRE-PROD frontend silently resolves to the DEV backend and the validation is fictional, and because the production promotion guard in the next epic has nothing to check unless the registry — not a file on a server — carries the record of what passed.

## Stories

- Story 5.1: Stand up the isolated PRE-PROD backend network
- Story 5.2: Provision the PRE-PROD stand on s1
- Story 5.3: Deploy a specific image tag to PRE-PROD
- Story 5.4: Record the validated candidate in the registry
- Story 5.5: Establish the release validation checklist
- Story 5.6: Exercise the full release cycle on an empty release

## Requirements & Constraints

- PRE-PROD deployment is dispatch-only with a mandatory image tag. No push, tag or schedule trigger may exist, and a dispatch without a tag is rejected rather than defaulting to anything.
- A tag that does not exist in the registry must fail the deploy **before** the running container is touched; PRE-PROD keeps serving the previous candidate. The proven order is resolve → pull → down → up → health check.
- Release history lives in the registry: a moving `preprod-current` marker plus an accumulating permanent `preprod-<sha>` tag per candidate. `<sha>` is the **commit** SHA (12 hex), never the environment-suffixed tag string, because the production promotion guard matches on commit identity. Retention protects both shapes by pattern, not by count.
- Recording is a separate dispatch-only step with a required `pass|fail` verdict, and it refuses to write unless the stand is demonstrably still serving that exact candidate's digest. This is a deliberate deviation from the original "retag automatically after a successful deploy": `preprod-<sha>` must mean *validated*, not merely *deployed*, because that is what the promotion guard reads it as.
- Backend isolation must be verified from **inside the running container** and end-to-end (a request reaching the PRE-PROD backend, with no matching entry in the DEV backend), never inferred from a compose file. DEV and legacy stands stay untouched, and no container joins two stand networks.
- Slack notification never gates a deploy. Deploy stories close with no notification step; that layer is added last, separately.
- Validation (5.5) needs a written checklist of critical flows with an explicit pass criterion per item, an outcome recorded against the specific image tag, a failing item blocking promotion, a non-blocking e2e placeholder job in the deploy with its intent documented, and real end-to-end coverage recorded as an explicit separate follow-up rather than absorbed here.
- The rehearsal (5.6) must run entirely through the workflows, record total elapsed time, restart from the beginning if a defect is fixed mid-run, and state in writing that release scope freeze is a process agreement with no technical control behind it.

## Technical Decisions

- Topology: s1 carries **two** stands, the new DEV and PRE-PROD. The legacy DEV stand is on a different host, and production has moved off s2 to a VM reached through a jump host — neither can collide with PRE-PROD.
- The PRE-PROD contour is already built and running by the neighbouring backend project: `crm-preprod-network`, with Kong named `crm-preprod-kong-gateway` carrying the network alias `crm-kong-gateway`. That alias is load-bearing: the frontend image bakes an nginx config that resolves the literal `crm-kong-gateway` on port 8000, and the image is byte-identical across stands, so there is no per-stand way to point it elsewhere.
- Stand layout: directory `~/crm-prionex/fe-prionex-preprod/`, host port **8083** (8081 is taken on s1, measured), distinct container name and compose project, attached to the PRE-PROD network. The parameterized artifact is the new stand compose file plus its env example; the legacy server compose file is deliberately untouched.
- Hostnames: frontend `crm.preprod.crm-prionex.online`, backend `https://api.crm.preprod.crm-prionex.online`. The shorter `*.preprod.crm-prionex.online` forms do not resolve. The frontend vhost and certificate were created by this epic; the API side already existed.
- These URL values are baked into the JavaScript bundle at build time, so a wrong hostname builds cleanly and fails only in a browser. They are read from a per-environment KV path in the secret store via AppRole (kept there for uniformity with the platform, not because they are confidential); the former PRE-PROD placeholder value is gone and the real values are verified by extracting them from the built bundle.
- Known open defect owned by the backend side: the PRE-PROD Kong's CORS origin still points at an unrelated localhost origin. Misconfigured is worse than unconfigured — it looks finished and fails only in a browser.
- Deploys run on the deploy runner located on the target host, addressed by label; no SSH client, scp or ssh actions appear in any deploy workflow. The workflow is a thin caller over the shared reusable deploy definition rather than a copy of its steps, and it must set the Kong-guard input to expect **routed** API responses, since PRE-PROD's Kong fronts real services while the shared default encodes DEV's unrouted behaviour. The serialization group must be written as a literal in the caller — a callee's own concurrency block is silently void — and the deploy takes the stand-directory lock.
- Registry access on the stand uses a read-only package token; writes of the release markers use the write-capable credential and are read back from the registry after every write.
- The human-readable validation record lives in a repository document maintained by the dev session; the registry carries identity and permanence; job logs and step summaries are best-effort only (image annotations are unavailable on this instance's toolchain).
- Where the epics document and the decision records disagree, the decision records and story files win: from Epic 5 onward, amendments were deliberately recorded there instead of in the epics file.

## Cross-Story Dependencies

- 5.1 verifies what the neighbouring project already provides and gates 5.2; 5.2's stand gates 5.3; 5.3's deploy gates 5.4's recording; 5.6 requires all five.
- 5.3 consumes Epic 4's shared deploy definition, stand compose parameterization and deploy lock, and Epic 3's image tagging; 5.2 consumes Epic 4's compose file and the credential/secret wiring from Epic 1.
- 5.5's checklist supplies the verdict and the note that 5.4's recorder already expects — 5.4 shipped first, so the checklist must fit the existing verdict input rather than the reverse.
- Epic 6's promotion guard consumes `preprod-<sha>` and must implement the exact inverse of the derivation used here; it can only prove commit identity, not artifact identity, because each environment's image is rebuilt. It is positioned as the frontend half of the backend project's existing digest-comparison gate, not as a competing mechanism.
- The Slack notification story is sequenced last and no Epic 5 story may block on it.
- Status: 5.1 through 5.4 are complete and merged; 5.5 and 5.6 remain.
