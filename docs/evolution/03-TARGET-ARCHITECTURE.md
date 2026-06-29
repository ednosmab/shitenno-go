# Target Architecture

## Objetivo
Transformar o Nexus em um núcleo de engenharia independente de interfaces.

## Camadas
- Adapters (CLI, API, MCP, VSCode)
- Application (Use Cases)
- Domain
- Infrastructure

## Diretrizes
- Dependências sempre apontam para o domínio.
- Nenhuma regra de negócio em adapters.
- Eventos de domínio desacoplados de providers.

---

## Current Architecture

For the current design principles, see [../architecture/design-principles.md](../architecture/design-principles.md).

For the current module structure, see [../architecture/domain-model-mapping.md](../architecture/domain-model-mapping.md).
