# Architecture Overview

> Generated: 2026-07-20T04:26:23.116Z

## System Architecture

The Shitenno follows a cognitive cycle architecture:

```
Observe → Understand → Reason → Decide → Validate → Act → Learn
   ↓          ↓          ↓        ↓         ↓        ↓      ↓
Context   Pattern    Goal    Decision   Policy   Action  Feedback
Pipeline  Detection  Engine  Engine     Engine   Engine  Loop
```

## Components

- **Context Pipeline:** Collects and processes project context
- **Pattern Detection:** Identifies patterns from history and codebase
- **Goal Engine:** Manages governance goals and targets
- **Decision Engine:** Evaluates actions using specialized evaluators
- **Policy Engine:** Enforces declarative governance policies
- **Action Engine:** Executes actions with idempotency guarantees
- **Plan Engine:** Coordinates sequences of actions
- **Feedback Loop:** Learns from session outcomes

## Metrics

- **Active Rules:** 13
- **Active Policies:** 13
- **Total Assets:** 125