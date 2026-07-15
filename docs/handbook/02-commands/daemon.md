# Daemon

Background automation service for Nexus governance.

---

## `nexus daemon`

Manages the Nexus daemon lifecycle. The daemon watches governance files and automatically reacts to changes (e.g., archiving completed plans).

### Subcommands

#### `nexus daemon start`

Start the daemon as a detached background process.

```bash
nexus daemon start
```

**What it does:**
- Spawns `src/daemon.ts` as a background process
- Creates a Unix domain socket at `nexus-system/daemon/daemon.sock`
- Writes PID to `nexus-system/daemon/daemon.pid`
- Starts file watcher on `nexus-system/governance/` and `nexus-system/docs/`
- Auto-archives completed plans

**Behaviour:**
- Respects `NEXUS_NO_DAEMON=1` or `CI=true` (skips startup)
- Waits up to 3s for socket to appear before returning
- Circuit breaker: if 5 crashes happen within 60s, daemon refuses to start
- First successful start creates `nexus-system/daemon/daemon.approved`

#### `nexus daemon stop`

Stop the daemon gracefully.

```bash
nexus daemon stop
```

**What it does:**
- Sends `SIGTERM` to the PID in `daemon.pid`
- Waits for clean shutdown (socket closed, PID file removed)

#### `nexus daemon status`

Show daemon status and diagnostics.

```bash
nexus daemon status
```

**Output includes:**
- Running state (running/stopped)
- Responsiveness (IPC ping)
- PID and uptime
- Circuit breaker state (tripped, crash count, last crash)
- Environment overrides (`NEXUS_NO_DAEMON`, `CI`)
- Approval state

#### `nexus daemon restart`

Restart the daemon (stop + wait 1s + start).

```bash
nexus daemon restart
```

### Circuit Breaker

The circuit breaker protects against crash loops:

| Threshold | Behaviour |
|-----------|-----------|
| 5 crashes in 60s | Circuit breaker trips |
| When tripped | `daemon start` and `daemon restart` refuse to start |
| Reset | After 30s of stable uptime, or delete `nexus-system/daemon/circuit-breaker.json` |

### Runtime Files

| File | Purpose |
|------|---------|
| `nexus-system/daemon/daemon.pid` | Current daemon PID |
| `nexus-system/daemon/daemon.sock` | Unix domain socket for IPC |
| `nexus-system/daemon/daemon.log` | Daemon log output |
| `nexus-system/daemon/circuit-breaker.json` | Crash tracking state |
| `nexus-system/daemon/daemon.approved` | First-start approval flag |

### IPC Protocol

The daemon exposes a Unix domain socket server with these message types:

| Message | Response |
|---------|----------|
| `ping` | `pong` |
| `handshake` | Version check |
| `status` | Uptime, PID, socket state |
| `stop` | Graceful self-termination |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXUS_NO_DAEMON=1` | Disable daemon auto-start |
| `CI=true` | Disable daemon in CI environments |
| `NEXUS_CHILD=1` | Internal: marks child processes |
