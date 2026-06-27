# 🧩 SKILL: DOMAIN-DRIVEN DESIGN (DDD) PATTERNS

## 🎯 Objetivo
Isolar a complexidade do domínio da infraestrutura, garantindo que as regras de negócio sejam o coração do sistema e permaneçam agnósticas a frameworks.

## 🏗️ Padrões de Arquitetura (Domain Layer)
1. **Entidades:** Objetos com identidade única que persiste através do tempo. Devem encapsular lógica de autovalidação.
2. **Value Objects (VOs):** Objetos definidos apenas por seus atributos, imutáveis. Sempre use VOs para evitar o "Primitive Obsession".
3. **Agregados:** Clusters de entidades e VOs que são tratados como uma única unidade para mudanças de dados. O **Aggregate Root** é o único ponto de entrada para o agregado.
4. **Repositórios (Interfaces):** Defina contratos no domínio para persistência. A implementação real (banco de dados, ORM, ou serviço externo) deve ficar na camada de infraestrutura.
5. **Domain Services:** Use quando uma operação de domínio não pertence naturalmente a uma única Entidade ou VO.

## 🛡️ Regras de Dependência
- A camada de **Domínio** (núcleo do core) NUNCA deve importar nada de **Infraestrutura** ou **UI**.
- Use **Injeção de Dependência** para fornecer implementações de infraestrutura para o domínio em tempo de execução.
